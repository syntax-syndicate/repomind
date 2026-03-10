import { createHash } from "node:crypto";

import { kv } from "@vercel/kv";

import type {
    SecurityFinding,
    SecurityVerificationSignal,
    SecurityVerificationStatus,
} from "@/lib/security-scanner";
import {
    SECURITY_CANARY_PERCENT,
    SECURITY_VERIFICATION_FLAGS,
    SECURITY_VERIFICATION_THRESHOLDS,
} from "@/lib/security-verification-config";
import { resolveDependencyAdvisory } from "@/lib/services/dependency-advisory";
import { findingFingerprint as buildFindingFingerprint } from "@/lib/services/report-service";

export interface FindingVerificationRecord {
    findingFingerprint: string;
    findingIndex: number;
    verificationStatus: SecurityVerificationStatus;
    lifecycleStatus: SecurityVerificationStatus;
    gateDecision: "include" | "exclude";
    verificationScore: number;
    verificationSignals: SecurityVerificationSignal[];
    verificationRationale: string;
    exploitabilityTag: SecurityFinding["exploitabilityTag"];
    finding: SecurityFinding;
}

export interface VerifierStats {
    detected: number;
    verifiedTrue: number;
    rejectedFalse: number;
    inconclusiveHidden: number;
    canaryApplied: boolean;
    verificationGateEnabled: boolean;
    verifiedOnlyReportsEnabled: boolean;
}

export interface VerifyDetectedFindingsResult {
    verifiedFindings: SecurityFinding[];
    hiddenFindings: SecurityFinding[];
    rejectedFindings: SecurityFinding[];
    records: FindingVerificationRecord[];
    stats: VerifierStats;
}

function clampScore(score: number): number {
    return Math.max(0, Math.min(1, score));
}

function hasEvidenceType(finding: SecurityFinding, type: "source" | "sink" | "sanitizer" | "context"): boolean {
    return Array.isArray(finding.evidence) && finding.evidence.some((signal) => signal.type === type);
}

function textForFinding(finding: SecurityFinding): string {
    return [
        finding.title,
        finding.description,
        finding.recommendation,
        finding.file,
        finding.cwe ?? "",
        finding.snippet ?? "",
    ].join(" ").toLowerCase();
}

function hasSanitizerHint(finding: SecurityFinding): boolean {
    const text = textForFinding(finding);
    return (
        hasEvidenceType(finding, "sanitizer") ||
        /(sanitize|sanitiz|escape|allowlist|whitelist|parameterized|prepared statement|validator|schema|zod|joi)/i.test(text)
    );
}

function hasInputSourceHint(finding: SecurityFinding): boolean {
    const text = textForFinding(finding);
    return /req\.|request\.|params\.|query\.|body\.|input|tainted|user/.test(text);
}

function inferExploitabilityTag(finding: SecurityFinding): SecurityFinding["exploitabilityTag"] {
    const text = textForFinding(finding);
    if (finding.severity === "critical") return "high";
    if (finding.severity === "high" && /(injection|secret|auth|token|command|sql|path traversal|rce)/.test(text)) {
        return "high";
    }
    if (finding.severity === "high" || finding.severity === "medium") return "medium";
    if (finding.severity === "low") return "low";
    return "unknown";
}

function stableCanaryHash(owner: string, repo: string): number {
    const input = `${owner}/${repo}`.toLowerCase();
    const digest = createHash("sha256").update(input).digest("hex");
    const bucket = Number.parseInt(digest.slice(0, 8), 16);
    return bucket % 100;
}

function isCanaryEnabled(owner: string, repo: string): boolean {
    if (SECURITY_CANARY_PERCENT >= 100) return true;
    return stableCanaryHash(owner, repo) < SECURITY_CANARY_PERCENT;
}

function scoreFromConfidence(finding: SecurityFinding): number {
    if (typeof finding.confidenceScore === "number") return finding.confidenceScore;
    if (finding.confidence === "high") return 0.9;
    if (finding.confidence === "medium") return 0.72;
    if (finding.confidence === "low") return 0.45;
    return 0.7;
}

function applySignal(
    signals: SecurityVerificationSignal[],
    score: number,
    signal: SecurityVerificationSignal,
): number {
    const weight = signal.weight ?? 0;
    signals.push(signal);
    return clampScore(score + (signal.passed ? weight : -weight));
}

async function verifyDependencyFinding(finding: SecurityFinding): Promise<{
    score: number;
    signals: SecurityVerificationSignal[];
    status: SecurityVerificationStatus;
    rationale: string;
    exploitabilityTag: SecurityFinding["exploitabilityTag"];
}> {
    let score = scoreFromConfidence(finding);
    const signals: SecurityVerificationSignal[] = [];

    score = applySignal(signals, score, {
        name: "has_dependency_cve_signal",
        passed: /CVE-\d{4}-\d+/i.test(finding.recommendation) || /CVE-\d{4}-\d+/i.test(finding.description),
        detail: "Dependency finding includes explicit CVE or advisory marker.",
        weight: 0.12,
    });

    const advisory = await resolveDependencyAdvisory(finding);
    score = applySignal(signals, score, {
        name: "live_advisory_resolution",
        passed: advisory.source === "live-osv" ? advisory.hasLiveMatch : true,
        detail: advisory.detail,
        weight: advisory.source === "live-osv" ? 0.15 : 0.06,
    });

    const status =
        score >= SECURITY_VERIFICATION_THRESHOLDS.autoVerified
            ? "AUTO_VERIFIED_TRUE"
            : score <= SECURITY_VERIFICATION_THRESHOLDS.autoRejected
                ? "AUTO_REJECTED_FALSE"
                : "INCONCLUSIVE_HIDDEN";

    return {
        score,
        signals,
        status,
        rationale: `Dependency verification used ${advisory.source} advisory resolution and exploitability tagging.`,
        exploitabilityTag: advisory.exploitabilityTag,
    };
}

function verifyCodeLikeFinding(finding: SecurityFinding): {
    score: number;
    signals: SecurityVerificationSignal[];
    status: SecurityVerificationStatus;
    rationale: string;
    exploitabilityTag: SecurityFinding["exploitabilityTag"];
} {
    let score = scoreFromConfidence(finding);
    const signals: SecurityVerificationSignal[] = [];
    const text = textForFinding(finding);
    const isInjectionFamily = /(injection|sql|xss|path traversal|command)/i.test(text);
    const hasSink = hasEvidenceType(finding, "sink") || /(query\(|exec\(|innerhtml|dangerouslysetinnerhtml|readfile)/i.test(text);
    const hasSource = hasEvidenceType(finding, "source") || hasInputSourceHint(finding);
    const noSanitizer = !hasSanitizerHint(finding);

    score = applySignal(signals, score, {
        name: "has_sink_signal",
        passed: hasSink,
        detail: "Potential exploit sink signal detected.",
        weight: 0.13,
    });

    score = applySignal(signals, score, {
        name: "has_source_signal",
        passed: hasSource,
        detail: "User-input or taint source signal detected.",
        weight: 0.1,
    });

    score = applySignal(signals, score, {
        name: "no_sanitizer_signal",
        passed: noSanitizer,
        detail: "No sanitization signal was detected in the local context.",
        weight: 0.12,
    });

    score = applySignal(signals, score, {
        name: "has_cwe_mapping",
        passed: Boolean(finding.cwe),
        detail: "Finding includes CWE mapping for classifier consistency.",
        weight: 0.05,
    });

    const mandatoryFlowSatisfied = !isInjectionFamily || (hasSink && hasSource && noSanitizer);

    const status =
        mandatoryFlowSatisfied && score >= SECURITY_VERIFICATION_THRESHOLDS.autoVerified
            ? "AUTO_VERIFIED_TRUE"
            : score <= SECURITY_VERIFICATION_THRESHOLDS.autoRejected || !mandatoryFlowSatisfied
                ? "AUTO_REJECTED_FALSE"
                : "INCONCLUSIVE_HIDDEN";

    return {
        score,
        signals,
        status,
        rationale: isInjectionFamily
            ? "Injection-family verification requires source-to-sink continuity and absence of sanitization signals."
            : "Code finding verification is confidence + evidence weighted.",
        exploitabilityTag: inferExploitabilityTag(finding),
    };
}

function verifySecretOrConfigFinding(finding: SecurityFinding): {
    score: number;
    signals: SecurityVerificationSignal[];
    status: SecurityVerificationStatus;
    rationale: string;
    exploitabilityTag: SecurityFinding["exploitabilityTag"];
} {
    let score = scoreFromConfidence(finding);
    const signals: SecurityVerificationSignal[] = [];
    const text = textForFinding(finding);
    const appearsPlaceholder = /(placeholder|dummy|example|changeme|test key|fake|fixture)/i.test(text);
    const looksProdPath = !/(test|fixture|spec|mock|sample)/i.test(finding.file.toLowerCase());

    score = applySignal(signals, score, {
        name: "non_placeholder_value",
        passed: !appearsPlaceholder,
        detail: "Secret/config value does not look like a placeholder token.",
        weight: 0.15,
    });

    score = applySignal(signals, score, {
        name: "production_context_path",
        passed: looksProdPath,
        detail: "File path context appears to be production-facing rather than tests/fixtures.",
        weight: 0.1,
    });

    score = applySignal(signals, score, {
        name: "high_confidence_detector",
        passed: finding.confidence === "high" || (finding.confidenceScore ?? 0) >= 0.85,
        detail: "Detector confidence signal from scanner metadata.",
        weight: 0.1,
    });

    const status =
        score >= SECURITY_VERIFICATION_THRESHOLDS.autoVerified
            ? "AUTO_VERIFIED_TRUE"
            : score <= SECURITY_VERIFICATION_THRESHOLDS.autoRejected
                ? "AUTO_REJECTED_FALSE"
                : "INCONCLUSIVE_HIDDEN";

    return {
        score,
        signals,
        status,
        rationale: "Secret/config verification combines placeholder detection, context checks, and detector confidence.",
        exploitabilityTag: inferExploitabilityTag(finding),
    };
}

async function verifySingleFinding(finding: SecurityFinding): Promise<{
    score: number;
    signals: SecurityVerificationSignal[];
    status: SecurityVerificationStatus;
    rationale: string;
    exploitabilityTag: SecurityFinding["exploitabilityTag"];
}> {
    if (finding.type === "dependency") {
        return verifyDependencyFinding(finding);
    }
    if (finding.type === "secret" || finding.type === "configuration") {
        return verifySecretOrConfigFinding(finding);
    }
    return verifyCodeLikeFinding(finding);
}

function toLifecycleStatus(status: SecurityVerificationStatus): SecurityVerificationStatus {
    if (status === "AUTO_VERIFIED_TRUE") return "OPEN";
    return status;
}

function annotateFinding(
    finding: SecurityFinding,
    result: {
        score: number;
        signals: SecurityVerificationSignal[];
        status: SecurityVerificationStatus;
        rationale: string;
        exploitabilityTag: SecurityFinding["exploitabilityTag"];
    },
    gateDecision: "include" | "exclude",
): SecurityFinding {
    return {
        ...finding,
        verificationStatus: result.status,
        verificationSignals: result.signals,
        verificationScore: result.score,
        verificationRationale: result.rationale,
        gateDecision,
        exploitabilityTag: result.exploitabilityTag,
    };
}

async function trackVerificationStats(stats: VerifierStats): Promise<void> {
    try {
        const pipeline = kv.pipeline();
        pipeline.incr("stats:security_verification:detected");
        pipeline.incrby("stats:security_verification:detected_total", stats.detected);
        pipeline.incrby("stats:security_verification:verified_true_total", stats.verifiedTrue);
        pipeline.incrby("stats:security_verification:rejected_false_total", stats.rejectedFalse);
        pipeline.incrby("stats:security_verification:inconclusive_hidden_total", stats.inconclusiveHidden);
        await pipeline.exec();
    } catch {
        // Telemetry must never interrupt scan flow.
    }
}

export async function verifyDetectedFindings(params: {
    scanId: string;
    owner: string;
    repo: string;
    findings: SecurityFinding[];
}): Promise<VerifyDetectedFindingsResult> {
    const canaryApplied = isCanaryEnabled(params.owner, params.repo);
    const verificationGateEnabled = SECURITY_VERIFICATION_FLAGS.verificationGate && canaryApplied;
    const verifiedOnlyReportsEnabled = SECURITY_VERIFICATION_FLAGS.verifiedOnlyReports && canaryApplied;

    if (!verificationGateEnabled) {
        const bypassed = params.findings.map((finding, index) => {
            const annotated = annotateFinding(
                finding,
                {
                    score: clampScore(Math.max(SECURITY_VERIFICATION_THRESHOLDS.autoVerified, scoreFromConfidence(finding))),
                    signals: [{
                        name: "verification_gate_bypassed",
                        passed: true,
                        detail: "Verification gate disabled by feature flag/canary; allowing finding.",
                        weight: 0,
                    }],
                    status: "AUTO_VERIFIED_TRUE",
                    rationale: "Verification gate bypassed; compatibility mode enabled.",
                    exploitabilityTag: inferExploitabilityTag(finding),
                },
                "include",
            );
            return {
                findingIndex: index,
                findingFingerprint: buildFindingFingerprint(annotated),
                verificationStatus: "AUTO_VERIFIED_TRUE" as const,
                lifecycleStatus: "OPEN" as const,
                gateDecision: "include" as const,
                verificationScore: annotated.verificationScore ?? 1,
                verificationSignals: annotated.verificationSignals ?? [],
                verificationRationale: annotated.verificationRationale ?? "",
                exploitabilityTag: annotated.exploitabilityTag ?? "unknown",
                finding: annotated,
            };
        });

        const stats: VerifierStats = {
            detected: params.findings.length,
            verifiedTrue: params.findings.length,
            rejectedFalse: 0,
            inconclusiveHidden: 0,
            canaryApplied,
            verificationGateEnabled,
            verifiedOnlyReportsEnabled,
        };

        await trackVerificationStats(stats);

        return {
            verifiedFindings: bypassed.map((record) => record.finding),
            hiddenFindings: [],
            rejectedFindings: [],
            records: bypassed,
            stats,
        };
    }

    const records: FindingVerificationRecord[] = [];
    const verifiedFindings: SecurityFinding[] = [];
    const hiddenFindings: SecurityFinding[] = [];
    const rejectedFindings: SecurityFinding[] = [];

    for (let index = 0; index < params.findings.length; index += 1) {
        const finding = params.findings[index];
        const result = await verifySingleFinding(finding);
        const gateDecision = result.status === "AUTO_VERIFIED_TRUE" ? "include" : "exclude";
        const annotated = annotateFinding(finding, result, gateDecision);
        const fingerprint = buildFindingFingerprint(annotated);

        if (gateDecision === "include" || !verifiedOnlyReportsEnabled) {
            verifiedFindings.push(annotated);
        } else if (result.status === "AUTO_REJECTED_FALSE") {
            rejectedFindings.push(annotated);
        } else {
            hiddenFindings.push(annotated);
        }

        records.push({
            findingIndex: index,
            findingFingerprint: fingerprint,
            verificationStatus: result.status,
            lifecycleStatus: toLifecycleStatus(result.status),
            gateDecision,
            verificationScore: result.score,
            verificationSignals: result.signals,
            verificationRationale: result.rationale,
            exploitabilityTag: result.exploitabilityTag,
            finding: annotated,
        });
    }

    const stats: VerifierStats = {
        detected: params.findings.length,
        verifiedTrue: records.filter((record) => record.verificationStatus === "AUTO_VERIFIED_TRUE").length,
        rejectedFalse: records.filter((record) => record.verificationStatus === "AUTO_REJECTED_FALSE").length,
        inconclusiveHidden: records.filter((record) => record.verificationStatus === "INCONCLUSIVE_HIDDEN").length,
        canaryApplied,
        verificationGateEnabled,
        verifiedOnlyReportsEnabled,
    };

    await trackVerificationStats(stats);

    return {
        verifiedFindings,
        hiddenFindings,
        rejectedFindings,
        records,
        stats,
    };
}

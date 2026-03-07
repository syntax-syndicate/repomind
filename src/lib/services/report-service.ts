import type { SecurityFinding } from "@/lib/security-scanner";
import type { StoredScan } from "@/lib/services/scan-storage";

export interface PriorScanDiff {
    new: number;
    resolved: number;
    unchanged: number;
}

export interface FindingActionPayload {
    index: number;
    fingerprint: string;
    chatPrompt: string;
    chatHref: string;
}

export interface ReportViewData {
    priorScanDiff: PriorScanDiff;
    topFixes: SecurityFinding[];
    rankedFindings: SecurityFinding[];
    findingActions: FindingActionPayload[];
}

const severityWeight: Record<SecurityFinding["severity"], number> = {
    critical: 100,
    high: 75,
    medium: 45,
    low: 20,
    info: 5,
};

const confidenceWeight: Record<NonNullable<SecurityFinding["confidence"]>, number> = {
    high: 20,
    medium: 10,
    low: 0,
};

function normalizeToken(input: string): string {
    return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function exploitabilityScore(finding: SecurityFinding): number {
    const text = normalizeToken(
        `${finding.title} ${finding.description} ${finding.recommendation} ${finding.type} ${finding.cwe ?? ""}`
    );

    let score = 0;

    if (
        /(remote code execution|rce|command injection|sql injection|auth bypass|privilege escalation|hardcoded secret|exposed.*token|unsafe child_process)/i.test(
            text
        )
    ) {
        score += 24;
    }

    if (/(injection|xss|ssrf|csrf|path traversal|deseriali[sz]ation|eval|exec|token|password|credential|secret)/i.test(text)) {
        score += 12;
    }

    if (finding.type === "secret") {
        score += 14;
    }

    const path = finding.file.toLowerCase();
    if (/(auth|login|middleware|api|route|controller|payment|billing|admin|token|session|crypto)/.test(path)) {
        score += 8;
    }

    if (typeof finding.cvss === "number") {
        score += Math.round(finding.cvss * 2);
    }

    return score;
}

export function findingFingerprint(finding: SecurityFinding): string {
    const descriptionSignature = normalizeToken(finding.description).slice(0, 120);
    return [
        normalizeToken(finding.type),
        normalizeToken(finding.file),
        normalizeToken(finding.title),
        normalizeToken(finding.cwe ?? ""),
        descriptionSignature,
    ].join("|");
}

export function scoreFindingForTriage(finding: SecurityFinding): number {
    const baseSeverity = severityWeight[finding.severity] ?? 0;
    const confidence = finding.confidence ? confidenceWeight[finding.confidence] : 8;
    return baseSeverity + confidence + exploitabilityScore(finding);
}

export function rankFindingsForTriage(findings: SecurityFinding[]): SecurityFinding[] {
    return [...findings].sort((a, b) => {
        const scoreDelta = scoreFindingForTriage(b) - scoreFindingForTriage(a);
        if (scoreDelta !== 0) return scoreDelta;

        const severityDelta = (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0);
        if (severityDelta !== 0) return severityDelta;

        const fileDelta = a.file.localeCompare(b.file);
        if (fileDelta !== 0) return fileDelta;

        return (a.line ?? 0) - (b.line ?? 0);
    });
}

export function computePriorScanDiff(
    currentFindings: SecurityFinding[],
    previousFindings: SecurityFinding[] | null | undefined
): PriorScanDiff {
    const currentSet = new Set(currentFindings.map(findingFingerprint));

    if (!previousFindings || previousFindings.length === 0) {
        return {
            new: currentSet.size,
            resolved: 0,
            unchanged: 0,
        };
    }

    const previousSet = new Set(previousFindings.map(findingFingerprint));

    let unchanged = 0;
    currentSet.forEach((fp) => {
        if (previousSet.has(fp)) unchanged += 1;
    });

    return {
        new: Math.max(0, currentSet.size - unchanged),
        resolved: Math.max(0, previousSet.size - unchanged),
        unchanged,
    };
}

export function buildFindingChatPrompt(owner: string, repo: string, finding: SecurityFinding): string {
    const location = `${finding.file}${finding.line ? `:${finding.line}` : ""}`;

    return [
        `Help me fix this security vulnerability in ${owner}/${repo}.`,
        `Issue: ${finding.title} (${finding.severity.toUpperCase()})`,
        `Location: ${location}`,
        `Description: ${finding.description}`,
        `Recommendation: ${finding.recommendation}`,
        "Please propose a minimal safe patch and include regression tests.",
    ].join("\n");
}

export function buildFindingChatHref(owner: string, repo: string, finding: SecurityFinding): string {
    const query = `${owner}/${repo}`;
    const prompt = buildFindingChatPrompt(owner, repo, finding);
    return `/chat?q=${encodeURIComponent(query)}&prompt=${encodeURIComponent(prompt)}`;
}

export function buildReportViewData(scan: StoredScan, previousScan?: StoredScan | null): ReportViewData {
    const rankedFindings = rankFindingsForTriage(scan.findings);
    const topFixes = rankedFindings.slice(0, 3);
    const priorScanDiff = computePriorScanDiff(scan.findings, previousScan?.findings ?? null);

    const findingActions = scan.findings.map((finding, index) => ({
        index,
        fingerprint: findingFingerprint(finding),
        chatPrompt: buildFindingChatPrompt(scan.owner, scan.repo, finding),
        chatHref: buildFindingChatHref(scan.owner, scan.repo, finding),
    }));

    return {
        priorScanDiff,
        topFixes,
        rankedFindings,
        findingActions,
    };
}

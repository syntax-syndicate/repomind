"use client";

import { useMemo, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { SecurityFinding } from "@/lib/security-scanner";
import type { StoredScan } from "@/lib/services/scan-storage";
import {
    type PriorScanDiff,
    findingFingerprint,
    scoreFindingForTriage,
} from "@/lib/services/report-service";
import { trackReportConversion } from "@/app/actions";
import { CodeBlock } from "@/components/CodeBlock";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    Copy,
    ExternalLink,
    Flame,
    GitPullRequest,
    Info,
    MessageCircle,
    Shield,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import ShareButton from "./ShareButton";
import { ExportButtons } from "./components/ExportButtons";

const severityConfig = {
    critical: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: Flame },
    high: { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle },
    medium: { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: AlertCircle },
    low: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Info },
    info: { color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: CheckCircle },
} as const;

const confidenceConfig = {
    high: { label: "High Confidence", className: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
    medium: { label: "Medium Confidence", className: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10" },
    low: { label: "Low Confidence", className: "text-zinc-300 border-zinc-500/30 bg-zinc-500/10" },
} as const;

function SeverityBadge({ severity }: { severity: string }) {
    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} border ${config.border}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">{severity}</span>
        </span>
    );
}

function ConfidenceBadge({ confidence }: { confidence?: SecurityFinding["confidence"] }) {
    if (!confidence) {
        return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border border-zinc-700 bg-zinc-800 text-zinc-300">
                Confidence: Not Scored
            </span>
        );
    }

    const config = confidenceConfig[confidence];
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
            {config.label}
        </span>
    );
}

function BadgeSection({ owner, repo, scanId }: { owner: string; repo: string; scanId: string }) {
    const badgeUrl = typeof window !== "undefined" ? `${window.location.origin}/api/badge/${owner}/${repo}` : "";
    const reportUrl = typeof window !== "undefined" ? `${window.location.origin}/report/${scanId}` : "";
    const markdownSnippet = `[![RepoMind Security](${badgeUrl})](${reportUrl})`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(markdownSnippet);
        toast.success("Badge Markdown copied to clipboard!");
    };

    if (!badgeUrl) return null;

    return (
        <div className="p-6 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-4 w-full text-left">
                <div className="flex items-center gap-2 text-indigo-400">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="font-medium">GitHub Status Badge</h3>
                </div>
                <p className="text-sm text-zinc-400 max-w-xl">
                    Add a dynamic security status badge to your GitHub README. It stays updated with your latest security scan results.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5 flex items-center justify-center min-h-[44px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={badgeUrl} alt="RepoMind Security Badge" className="h-[20px]" />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
                <button
                    onClick={copyToClipboard}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95 whitespace-nowrap"
                >
                    <Copy className="w-4 h-4" />
                    Copy Markdown
                </button>
                <a
                    href={badgeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-all border border-white/5 whitespace-nowrap"
                >
                    <ExternalLink className="w-4 h-4" />
                    View SVG
                </a>
            </div>
        </div>
    );
}

interface ReportContentProps {
    scan: StoredScan;
    priorScanDiff: PriorScanDiff;
    topFixes: SecurityFinding[];
    hasPreviousScan: boolean;
}

export function ReportContent({
    scan,
    priorScanDiff,
    topFixes,
    hasPreviousScan,
}: ReportContentProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const date = new Date(scan.timestamp);
    const { data: session } = useSession();
    const router = useRouter();

    const topFixesWithIndex = useMemo(() => {
        const usedIndexes = new Set<number>();

        return topFixes
            .map((finding) => {
                const fp = findingFingerprint(finding);
                let idx = -1;
                for (let i = 0; i < scan.findings.length; i += 1) {
                    if (usedIndexes.has(i)) continue;
                    if (findingFingerprint(scan.findings[i]) === fp) {
                        idx = i;
                        usedIndexes.add(i);
                        break;
                    }
                }

                return { finding, index: idx };
            })
            .filter((entry) => entry.index >= 0);
    }, [topFixes, scan.findings]);

    const handleDiscussInChat = (index: number) => {
        const finding = scan.findings[index];
        const prompt = `I'm looking at a security finding: "${finding.title}" in ${finding.file}. 
Issue: ${finding.description}
Recommendation: ${finding.recommendation}

Can you help me understand how to fix this?`;

        void trackReportConversion("report_discuss_in_chat_clicked", scan.id);
        router.push(`/chat?q=${encodeURIComponent(`${scan.owner}/${scan.repo}`)}&prompt=${encodeURIComponent(prompt)}`);
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 selection:bg-indigo-500/30">
            <div className="max-w-4xl mx-auto space-y-8" ref={reportRef}>
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-indigo-400">
                            <Shield className="w-6 h-6" />
                            <h1 className="text-xl font-medium tracking-tight">RepoMind Security Report</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <ExportButtons scan={scan} reportRef={reportRef} />
                            <ShareButton scanId={scan.id} />
                        </div>
                    </div>

                    <div className="p-6 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-2xl font-semibold text-white">
                                    <span className="text-zinc-500 font-normal">{scan.owner} / </span>
                                    {scan.repo}
                                </h2>
                            </div>
                            <div className="text-sm text-zinc-400 flex flex-wrap items-center gap-3">
                                <span>Scanned on {date.toLocaleDateString()} at {date.toLocaleTimeString()}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs">
                                    {scan.depth === "deep" ? "Deep Analysis" : "Quick Scan"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-indigo-200">Developer Workflow Boost</h3>
                            <p className="text-sm text-zinc-300">
                                Log in to send findings into main chat with full context now. Phase 2 unlocks PR-ready fixes for private repos directly from this report.
                            </p>
                        </div>
                        {!session?.user ? (
                            <button
                                onClick={() => signIn("github", { callbackUrl: window.location.href })}
                                className="px-4 py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-100 transition-all whitespace-nowrap"
                            >
                                Log in with GitHub
                            </button>
                        ) : (
                            <button
                                onClick={() => router.push(`/chat?q=${encodeURIComponent(`${scan.owner}/${scan.repo}`)}&prompt=${encodeURIComponent("Prioritize and fix the most critical findings from this security report.")}`)}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
                            >
                                Open Main Chat
                            </button>
                        )}
                    </div>

                    <BadgeSection owner={scan.owner} repo={scan.repo} scanId={scan.id} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {(Object.keys(severityConfig) as Array<keyof typeof severityConfig>).map((sev) => {
                        const count = scan.summary[sev] || 0;
                        const config = severityConfig[sev];
                        const Icon = config.icon;

                        return (
                            <div key={sev} className={`p-4 rounded-xl border ${count > 0 ? config.border : "border-white/5"} ${count > 0 ? config.bg : "bg-zinc-900/50"} flex flex-col items-center justify-center text-center`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`w-4 h-4 ${count > 0 ? config.color : "text-zinc-600"}`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${count > 0 ? config.color : "text-zinc-500"}`}>{sev}</span>
                                </div>
                                <span className={`text-3xl font-bold ${count > 0 ? "text-white" : "text-zinc-700"}`}>{count}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 bg-zinc-900/70 border border-white/10 rounded-2xl">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="text-lg font-medium text-zinc-100">What Changed Since Last Scan</h3>
                        <span className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-zinc-400 bg-zinc-950">
                            {hasPreviousScan ? "Compared to previous scan" : "Baseline scan"}
                        </span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-2">
                        {hasPreviousScan
                            ? "Use this delta to focus on newly introduced risk first, then clean up older unresolved findings."
                            : "No earlier scan found for this repository yet. This report is your baseline for future change tracking."}
                    </p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                            <p className="text-xs uppercase tracking-wider text-red-300">New</p>
                            <p className="text-2xl font-bold text-white mt-1">{priorScanDiff.new}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="text-xs uppercase tracking-wider text-emerald-300">Resolved</p>
                            <p className="text-2xl font-bold text-white mt-1">{priorScanDiff.resolved}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-500/20 bg-zinc-500/10 p-4">
                            <p className="text-xs uppercase tracking-wider text-zinc-300">Unchanged</p>
                            <p className="text-2xl font-bold text-white mt-1">{priorScanDiff.unchanged}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-zinc-900 border border-white/10 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium text-zinc-100">Fix These First</h3>
                        <span className="text-xs text-zinc-400 border border-white/10 rounded-full px-2.5 py-1">
                            Ranked by impact, confidence, and exploitability
                        </span>
                    </div>
                    {topFixesWithIndex.length === 0 ? (
                        <div className="p-4 rounded-xl border border-white/5 bg-zinc-950/60 text-sm text-zinc-400">
                            No vulnerabilities to prioritize in this scan.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {topFixesWithIndex.map(({ finding, index }, rank) => (
                                <div key={`${findingFingerprint(finding)}:${rank}`} className="p-4 rounded-xl border border-white/10 bg-zinc-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-1">
                                                Priority #{rank + 1}
                                            </span>
                                            <SeverityBadge severity={finding.severity} />
                                            <ConfidenceBadge confidence={finding.confidence} />
                                        </div>
                                        <p className="text-sm font-medium text-zinc-100">{finding.title}</p>
                                        <p className="text-xs text-zinc-400">
                                            {finding.file}{finding.line ? `:${finding.line}` : ""} • Triage score {scoreFindingForTriage(finding)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDiscussInChat(index)}
                                        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        Discuss Fix
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <h3 className="text-lg font-medium border-b border-white/10 pb-2">Detailed Findings ({scan.findings.length})</h3>

                    {scan.findings.length === 0 ? (
                        <div className="p-8 text-center bg-zinc-900/50 border border-white/5 rounded-xl">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-50" />
                            <h4 className="text-zinc-300 font-medium mb-1">No vulnerabilities found</h4>
                            <p className="text-zinc-500 text-sm">This repository looks clean based on the scan configuration.</p>
                        </div>
                    ) : (
                        scan.findings.map((finding, idx) => (
                            <div key={idx} className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden shadow-lg" style={{ pageBreakInside: "avoid" }}>
                                <div className="p-5 border-b border-white/5 bg-zinc-950/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <SeverityBadge severity={finding.severity} />
                                            <span className="px-2.5 py-1 bg-zinc-800 rounded-full text-xs font-mono text-zinc-300 border border-zinc-700">
                                                {finding.type}
                                            </span>
                                            <ConfidenceBadge confidence={finding.confidence} />
                                            {(finding.cwe || finding.cvss) && (
                                                <span className="text-xs text-zinc-500 flex items-center gap-2">
                                                    {finding.cwe && <span>{finding.cwe}</span>}
                                                    {finding.cvss && <span>CVSS: {finding.cvss}</span>}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-lg font-medium text-zinc-100">{finding.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-2 print:hidden">
                                        <button
                                            onClick={() => handleDiscussInChat(idx)}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            Discuss Fix
                                        </button>
                                    </div>
                                </div>

                                <div className="p-5 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2 space-y-2">
                                            <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Description</h5>
                                            <p className="text-sm text-zinc-300 leading-relaxed">{finding.description}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Location</h5>
                                            <div className="bg-black/50 p-3 rounded-lg border border-white/5 break-all">
                                                <span className="text-sm font-mono text-indigo-300">{finding.file}</span>
                                                {finding.line && <span className="text-sm font-mono text-zinc-500">:{finding.line}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Why Flagged</h5>
                                        <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-300 space-y-2">
                                            <p>Rule trigger: <span className="text-zinc-100 font-medium">{finding.title}</span></p>
                                            {finding.cwe && <p>Mapped security category: <span className="text-zinc-100">{finding.cwe}</span></p>}
                                            {typeof finding.cvss === "number" && <p>Risk score reference: <span className="text-zinc-100">CVSS {finding.cvss}</span></p>}
                                            {finding.line && <p>Detected near source line <span className="text-zinc-100">{finding.line}</span>.</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-2 flex flex-col" style={{ pageBreakInside: "avoid" }}>
                                        <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recommendation</h5>
                                        <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-lg">
                                            <p className="text-sm text-indigo-200">{finding.recommendation}</p>
                                        </div>
                                    </div>

                                    {finding.snippet && (
                                        <div className="space-y-2 pt-2" style={{ pageBreakInside: "avoid" }}>
                                            <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Context Snippet</h5>
                                            <CodeBlock
                                                language={finding.file.split(".").pop() || "text"}
                                                value={finding.snippet}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="pt-8 text-center text-sm text-zinc-600 no-export">
                    <p>Generated by <a href={process.env.NEXT_PUBLIC_APP_URL || "https://repomind.in"} className="font-semibold text-zinc-500 hover:text-indigo-400 transition-colors">RepoMind</a> — The AI developer sidekick.</p>
                </div>
            </div>
        </div>
    );
}

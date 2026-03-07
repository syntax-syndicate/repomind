"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ArrowLeft, GitPullRequest, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CodeBlock } from "@/components/CodeBlock";
import type {
    ChangedFile,
    DiffViewMode,
    FixIntent,
    FixPreviewResponse,
    PrCreateResponse,
    PrPrepareResponse,
} from "@/lib/types/fix";

function languageFromPath(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const languageMap: Record<string, string> = {
        ts: "typescript",
        tsx: "tsx",
        js: "javascript",
        jsx: "jsx",
        py: "python",
        go: "go",
        rs: "rust",
        java: "java",
        rb: "ruby",
        php: "php",
        css: "css",
        scss: "scss",
        html: "html",
        md: "markdown",
        json: "json",
        yml: "yaml",
        yaml: "yaml",
        sh: "bash",
    };
    return languageMap[ext] || "text";
}

interface FixWorkspaceProps {
    scanId: string;
    owner: string;
    repo: string;
    findingIndex: number;
    intent: FixIntent;
    sessionId?: string;
}

export function FixWorkspace({
    scanId,
    owner,
    repo,
    findingIndex,
    intent,
    sessionId,
}: FixWorkspaceProps) {
    const router = useRouter();
    const { data: session } = useSession();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<FixPreviewResponse | null>(null);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [viewMode, setViewMode] = useState<DiffViewMode>("unified");

    const [showPrPanel, setShowPrPanel] = useState(intent === "pr");
    const [prepareResult, setPrepareResult] = useState<PrPrepareResponse | null>(null);
    const [preparingPr, setPreparingPr] = useState(false);
    const [creatingPr, setCreatingPr] = useState(false);
    const [createdPr, setCreatedPr] = useState<PrCreateResponse | null>(null);
    const [prTitle, setPrTitle] = useState("");
    const [prBody, setPrBody] = useState("");
    const [baseBranch, setBaseBranch] = useState("");
    const [useFork, setUseFork] = useState(false);

    const loadPreview = useCallback(async () => {
        setLoading(true);
        setError(null);
        setCreatedPr(null);
        setPrepareResult(null);

        try {
            if (sessionId) {
                const res = await fetch(`/api/fix/session?sessionId=${sessionId}`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load fix session.");
                }
                const sessionData = data as FixPreviewResponse; // FixSession is compatible enough or adjust
                setPreview(sessionData);
                setPrTitle(sessionData.suggestedPrTitle || `fix: ${sessionData.finding.title}`);
                setPrBody(sessionData.suggestedPrBody || `Patch for ${sessionData.finding.title}`);
                setSelectedFileIndex(0);
                return;
            }

            const res = await fetch("/api/fix/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scanId, findingIndex }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to build fix preview.");
            }

            setPreview(data as FixPreviewResponse);
            setPrTitle((data as FixPreviewResponse).suggestedPrTitle);
            setPrBody((data as FixPreviewResponse).suggestedPrBody);
            setSelectedFileIndex(0);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to generate preview.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [findingIndex, scanId, sessionId]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    const selectedFile: ChangedFile | null = useMemo(() => {
        if (!preview) return null;
        return preview.files[selectedFileIndex] || preview.files[0] || null;
    }, [preview, selectedFileIndex]);

    const preparePrFlow = useCallback(async () => {
        if (!preview) return;

        if (!session?.user) {
            signIn("github", { callbackUrl: window.location.href });
            return;
        }

        setPreparingPr(true);
        try {
            const res = await fetch("/api/fix/pr/prepare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: preview.sessionId }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to prepare PR flow.");
            }
            const result = data as PrPrepareResponse;
            setPrepareResult(result);
            setBaseBranch(result.defaultBranch || "main");
            setUseFork(result.mode === "fork_required");
            setShowPrPanel(true);

            if (result.mode === "reauth_required") {
                toast.info("GitHub repo permission required before creating PR.");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to prepare PR.");
        } finally {
            setPreparingPr(false);
        }
    }, [preview, session?.user]);

    useEffect(() => {
        if (intent === "pr" && preview && !prepareResult && !preparingPr) {
            preparePrFlow();
        }
    }, [intent, preview, prepareResult, preparingPr, preparePrFlow]);

    const createPr = useCallback(async () => {
        if (!preview) return;
        if (!prTitle.trim()) {
            toast.error("PR title is required.");
            return;
        }

        setCreatingPr(true);
        try {
            const res = await fetch("/api/fix/pr/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: preview.sessionId,
                    title: prTitle.trim(),
                    body: prBody,
                    baseBranch: baseBranch || undefined,
                    useFork,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to create PR.");
            }
            setCreatedPr(data as PrCreateResponse);
            toast.success("PR created successfully.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create PR.");
        } finally {
            setCreatingPr(false);
        }
    }, [baseBranch, prBody, prTitle, preview, useFork]);

    const diffContent = selectedFile
        ? viewMode === "unified"
            ? selectedFile.unifiedDiff
            : viewMode === "before"
                ? selectedFile.before
                : selectedFile.after
        : "";

    const diffLanguage = selectedFile
        ? viewMode === "unified"
            ? "diff"
            : languageFromPath(selectedFile.path)
        : "text";

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <button
                                onClick={() => router.back()}
                                className="inline-flex items-center gap-1 text-sm hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                            <span>•</span>
                            <span className="text-sm">{owner}/{repo}</span>
                        </div>
                        <h1 className="text-2xl font-semibold">Fix Workspace</h1>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={loadPreview}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-sm font-medium disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            Regenerate
                        </button>
                        {preview && (
                            <Link
                                href={preview.chatHref}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Open Full Chat
                            </Link>
                        )}
                        <button
                            onClick={preparePrFlow}
                            disabled={loading || preparingPr || !preview}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50"
                        >
                            {preparingPr ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
                            Create PR
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="p-8 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-zinc-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Building fix preview...
                    </div>
                )}

                {error && !loading && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200">
                        {error}
                    </div>
                )}

                {preview && !loading && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-4 rounded-xl border border-white/10 bg-zinc-900">
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Files changed</p>
                                <p className="text-2xl font-semibold mt-1">{preview.summary.filesChanged}</p>
                            </div>
                            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                                <p className="text-xs text-emerald-300 uppercase tracking-wider">Additions</p>
                                <p className="text-2xl font-semibold mt-1">+{preview.summary.additions}</p>
                            </div>
                            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10">
                                <p className="text-xs text-red-300 uppercase tracking-wider">Deletions</p>
                                <p className="text-2xl font-semibold mt-1">-{preview.summary.deletions}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            <div className="lg:col-span-1 space-y-2">
                                <div className="p-3 rounded-xl border border-white/10 bg-zinc-900">
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Changed files</p>
                                    <div className="space-y-2">
                                        {preview.files.map((file, index) => (
                                            <button
                                                key={`${file.path}-${index}`}
                                                onClick={() => setSelectedFileIndex(index)}
                                                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${selectedFileIndex === index ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/5 bg-zinc-950/60 hover:bg-zinc-800"}`}
                                            >
                                                <p className="text-xs font-mono truncate">{file.path}</p>
                                                <p className="text-[11px] text-zinc-400 mt-1">
                                                    +{file.additions} / -{file.deletions}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-3 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {(["unified", "before", "after"] as DiffViewMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setViewMode(mode)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border ${viewMode === mode ? "bg-white text-black border-white" : "bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800"}`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>

                                {selectedFile ? (
                                    <CodeBlock
                                        language={diffLanguage}
                                        value={diffContent}
                                    />
                                ) : (
                                    <div className="p-6 rounded-xl border border-white/10 bg-zinc-900 text-zinc-400">
                                        Select a changed file to inspect diff content.
                                    </div>
                                )}
                            </div>
                        </div>

                        {showPrPanel && (
                            <div className="p-4 rounded-xl border border-white/10 bg-zinc-900 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-lg font-semibold">Create Pull Request</h2>
                                    {prepareResult?.mode === "fork_required" && (
                                        <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                                            Fork required
                                        </span>
                                    )}
                                </div>

                                {prepareResult?.mode === "reauth_required" && (
                                    <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 text-yellow-200 text-sm space-y-2">
                                        <p>{prepareResult.reauthReason || "GitHub repo scope is required."}</p>
                                        <button
                                            onClick={() =>
                                                signIn(
                                                    "github",
                                                    { callbackUrl: window.location.href },
                                                    { scope: "read:user user:email repo" }
                                                )
                                            }
                                            className="px-3 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-zinc-200"
                                        >
                                            Grant Repo Access
                                        </button>
                                    </div>
                                )}

                                {prepareResult && prepareResult.mode !== "reauth_required" && (
                                    <>
                                        <label className="block space-y-1">
                                            <span className="text-xs text-zinc-400 uppercase tracking-wider">Title</span>
                                            <input
                                                value={prTitle}
                                                onChange={(e) => setPrTitle(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-sm"
                                            />
                                        </label>

                                        <label className="block space-y-1">
                                            <span className="text-xs text-zinc-400 uppercase tracking-wider">Description</span>
                                            <textarea
                                                value={prBody}
                                                onChange={(e) => setPrBody(e.target.value)}
                                                rows={7}
                                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-sm"
                                            />
                                        </label>

                                        <label className="block space-y-1">
                                            <span className="text-xs text-zinc-400 uppercase tracking-wider">Base Branch</span>
                                            <input
                                                value={baseBranch}
                                                onChange={(e) => setBaseBranch(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-sm"
                                            />
                                        </label>

                                        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                                            <input
                                                type="checkbox"
                                                checked={useFork}
                                                onChange={(e) => setUseFork(e.target.checked)}
                                            />
                                            Create PR from fork (recommended if you cannot push to upstream)
                                        </label>

                                        <button
                                            onClick={createPr}
                                            disabled={creatingPr}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
                                        >
                                            {creatingPr ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
                                            Submit PR
                                        </button>

                                        {createdPr && (
                                            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-100 text-sm">
                                                <p>PR created successfully.</p>
                                                <a
                                                    href={createdPr.prUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="underline"
                                                >
                                                    Open PR #{createdPr.prNumber}
                                                </a>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

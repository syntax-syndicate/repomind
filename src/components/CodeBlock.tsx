"use client";

import { useState } from "react";
import { Check, Copy, Eye, FileCode, Play, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { EnhancedMarkdown } from "./EnhancedMarkdown";

interface CodeBlockProps {
    language: string;
    value: string;
    components?: any;
    owner?: string;
    repo?: string;
}

export function CodeBlock({ language, value, components, owner, repo }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const router = useRouter();

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePreviewFix = async () => {
        if (!owner || !repo) {
            toast.error("Repository context missing");
            return;
        }

        setIsCreatingSession(true);
        try {
            const res = await fetch("/api/fix/from-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner,
                    repo,
                    filePath: "analyzed_file", // Ideally detect this, but we'll use a placeholder for now
                    content: value,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create fix session");

            router.push(`/fix/from-chat?sessionId=${data.sessionId}&owner=${owner}&repo=${repo}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to initiate fix");
        } finally {
            setIsCreatingSession(false);
        }
    };

    const isMarkdown = language === 'markdown';

    return (
        <div className="relative my-4 rounded-lg border border-white/10 bg-[#1e1e1e] grid min-w-0 max-w-full">
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-white/5">
                <span className="text-xs text-zinc-400 font-mono uppercase">{language || 'text'}</span>
                <div className="flex items-center gap-2">
                    {isMarkdown && (
                        <button
                            onClick={() => setIsPreview(!isPreview)}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                            title={isPreview ? "Show raw code" : "Show preview"}
                        >
                            {isPreview ? (
                                <>
                                    <FileCode className="w-3.5 h-3.5" />
                                    <span>Raw</span>
                                </>
                            ) : (
                                <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Preview</span>
                                </>
                            )}
                        </button>
                    )}
                    {owner && repo && language && !isMarkdown && (
                        <button
                            onClick={handlePreviewFix}
                            disabled={isCreatingSession}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md transition-colors disabled:opacity-50"
                            title="Preview this change in Fix Workspace"
                        >
                            {isCreatingSession ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Play className="w-3.5 h-3.5" />
                            )}
                            <span>Preview Fix</span>
                        </button>
                    )}
                    <button
                        onClick={handleCopy}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors flex-shrink-0"
                        title="Copy code"
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            {isPreview ? (
                <div className="p-4 bg-zinc-900/50 overflow-x-auto w-full min-w-0">
                    <div className="prose prose-invert prose-sm max-w-none">
                        <EnhancedMarkdown content={value} components={components} />
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto w-full min-w-0">
                    <SyntaxHighlighter
                        language={language}
                        style={vscDarkPlus}
                        customStyle={{
                            margin: 0,
                            padding: '1rem',
                            background: 'transparent',
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            whiteSpace: 'pre', // Force no wrapping
                        }}
                        wrapLines={false}
                        wrapLongLines={false}
                    >
                        {value}
                    </SyntaxHighlighter>
                </div>
            )}
        </div>
    );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Repository Analyzer for GitHub Projects | RepoMind",
  description:
    "Use RepoMind to analyze GitHub repositories end-to-end. Explore architecture, code quality, and security insights in one workflow.",
  alternates: {
    canonical: "/repo-analyzer",
  },
};

export default function RepoAnalyzerPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Repository Analyzer for Engineering Teams</h1>
        <p className="text-zinc-300 text-lg leading-relaxed mb-8">
          RepoMind combines code analysis, architecture understanding, and security scanning to help you evaluate repositories quickly.
        </p>
        <div className="grid gap-4 md:grid-cols-2 mb-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-xl font-semibold mb-2">Full-Repo Context</h2>
            <p className="text-zinc-400">Analyze behavior across modules instead of isolated snippets.</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-xl font-semibold mb-2">Faster Decisions</h2>
            <p className="text-zinc-400">Understand maintainability, risk, and architecture before deep manual review.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/chat" className="px-5 py-3 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors">
            Analyze a Repository
          </Link>
          <Link href="/code-analyzer" className="px-5 py-3 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors">
            Code Analyzer
          </Link>
          <Link href="/security-scanner" className="px-5 py-3 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors">
            Security Scanner
          </Link>
        </div>
      </div>
    </main>
  );
}

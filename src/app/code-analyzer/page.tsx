import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Code Analyzer for GitHub Repositories | RepoMind",
  description:
    "Analyze GitHub repositories with RepoMind's AI code analyzer. Understand architecture, explore logic, and speed up code reviews.",
  alternates: {
    canonical: "/code-analyzer",
  },
};

export default function CodeAnalyzerPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">AI Code Analyzer for GitHub Repos</h1>
        <p className="text-zinc-300 text-lg leading-relaxed mb-8">
          RepoMind helps you analyze repository structure, understand code flow, and answer deep codebase questions in minutes.
        </p>
        <div className="grid gap-4 md:grid-cols-2 mb-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-xl font-semibold mb-2">Architecture Understanding</h2>
            <p className="text-zinc-400">Generate high-level and file-level understanding of large repositories quickly.</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-xl font-semibold mb-2">Developer Q&A</h2>
            <p className="text-zinc-400">Ask focused questions about APIs, modules, dependencies, and implementation details.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/chat" className="px-5 py-3 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors">
            Try RepoMind
          </Link>
          <Link href="/repo-analyzer" className="px-5 py-3 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors">
            Repo Analyzer
          </Link>
          <Link href="/security-scanner" className="px-5 py-3 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors">
            Security Scanner
          </Link>
        </div>
      </div>
    </main>
  );
}

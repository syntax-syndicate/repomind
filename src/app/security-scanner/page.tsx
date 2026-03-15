import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Repository Security Scanner for GitHub | RepoMind",
  description:
    "Scan GitHub repositories for vulnerabilities with RepoMind. Get actionable findings and prioritize code security faster.",
  alternates: {
    canonical: "/security-scanner",
  },
};

export default function SecurityScannerPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">AI Security Scanner for Repositories</h1>
        <p className="text-zinc-300 text-lg leading-relaxed mb-8">
          RepoMind surfaces security risks in GitHub repositories with context, helping teams prioritize critical fixes without noise.
        </p>
        <div className="grid gap-4 md:grid-cols-2 mb-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-xl font-semibold mb-2">Actionable Findings</h2>
            <p className="text-zinc-400">Review risks with code context, confidence signals, and remediation guidance.</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-xl font-semibold mb-2">Fast Triage</h2>
            <p className="text-zinc-400">Focus on meaningful vulnerabilities and reduce time spent on low-value alerts.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/chat" className="px-5 py-3 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors">
            Start Security Scan
          </Link>
          <Link href="/code-analyzer" className="px-5 py-3 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors">
            Code Analyzer
          </Link>
          <Link href="/repo-analyzer" className="px-5 py-3 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors">
            Repo Analyzer
          </Link>
        </div>
      </div>
    </main>
  );
}

import { Suspense } from 'react';
import { Metadata } from 'next';
import HomeClient from './HomeClient';
import { getHomepagePosts } from '@/lib/services/blog-service';

export const metadata: Metadata = {
  title: "AI Code Analyzer & Security Scanner for GitHub Repos | RepoMind",
  description:
    "RepoMind is an AI code analyzer and security scanner for GitHub repositories. Analyze architecture, review code, and audit repos faster.",
  keywords: [
    "code analyzer",
    "security scanner",
    "repo analyzer",
    "github code analyzer",
    "repository security scanner",
    "ai code review tool",
  ],
  alternates: {
    canonical: '/',
  },
};

export default async function Home() {
  const latestPosts = await getHomepagePosts();

  return (
    <Suspense fallback={null}>
      <HomeClient initialPosts={latestPosts} />
    </Suspense>
  );
}

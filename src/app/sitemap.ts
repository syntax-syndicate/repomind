import { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { getPublishedPosts } from "@/lib/services/blog-service";

export const dynamic = 'force-static';

interface TopRepoEntry {
    owner: string;
    repo: string;
    topics?: string[];
}

function isTopRepoEntry(value: unknown): value is TopRepoEntry {
    return Boolean(
        value &&
        typeof value === "object" &&
        "owner" in value &&
        "repo" in value &&
        typeof (value as { owner?: unknown }).owner === "string" &&
        typeof (value as { repo?: unknown }).repo === "string"
    );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = getCanonicalSiteUrl();
    const blogPosts = await getPublishedPosts();

    const defaultRoutes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${baseUrl}/chat`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
        ...blogPosts.map((post) => ({
            url: `${baseUrl}/blog/${post.slug}`,
            lastModified: post.updatedAt,
            changeFrequency: "monthly" as const,
            priority: 0.7,
        })),
    ];

    let repoRoutes: MetadataRoute.Sitemap = [];
    let topicRoutes: MetadataRoute.Sitemap = [];

    try {
            const dataPath = path.join(process.cwd(), 'public', 'data', 'top-repos.json');
            if (fs.existsSync(dataPath)) {
                const fileContent = fs.readFileSync(dataPath, 'utf8');
                const parsed: unknown = JSON.parse(fileContent);
                const repos = Array.isArray(parsed) ? parsed.filter(isTopRepoEntry) : [];

                repoRoutes = repos.map((repo) => ({
                    url: `${baseUrl}/repo/${repo.owner}/${repo.repo}`,
                    lastModified: new Date(),
                    changeFrequency: "weekly",
                    priority: 0.8,
                }));

                const uniqueTopics = new Set<string>();
                for (const repo of repos) {
                    if (!Array.isArray(repo.topics)) continue;
                    for (const topic of repo.topics) {
                        if (typeof topic === "string" && topic.trim()) {
                            uniqueTopics.add(topic.toLowerCase());
                        }
                    }
                }

                topicRoutes = Array.from(uniqueTopics).map((topic) => ({
                    url: `${baseUrl}/topics/${encodeURIComponent(topic)}`,
                    lastModified: new Date(),
                    changeFrequency: "weekly",
                    priority: 0.7,
                }));
            }
    } catch (e) {
        console.error("Failed to generate sitemap routes from top-repos.json", e);
    }

    return [...defaultRoutes, ...repoRoutes, ...topicRoutes];
}

"use client";

import { useState, useEffect } from "react";
import { fetchProfile, fetchRepoDetails } from "@/app/actions";
import { DeveloperCard } from "./DeveloperCard";
import { RepoCard } from "./RepoCard";
import { Loader2 } from "lucide-react";

interface SmartLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href?: string;
    currentOwner?: string;
    currentRepo?: string;
}

export function SmartLink({ href, children, currentOwner, currentRepo, ...props }: SmartLinkProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [type, setType] = useState<"profile" | "repo" | "link" | "preview">("link");

    useEffect(() => {
        if (!href) return;

        if (href.startsWith("#preview-")) {
            setType("preview");
            return;
        }

        // Check if it's a GitHub URL
        const githubUrlRegex = /^https:\/\/github\.com\/([a-zA-Z0-9-]+)(\/([a-zA-Z0-9-_\.]+))?$/;
        const match = href.match(githubUrlRegex);

        if (match) {
            const username = match[1];
            const repo = match[3];

            // Normalize for comparison
            const isSameUser = currentOwner?.toLowerCase() === username.toLowerCase();
            const isSameRepo = isSameUser && repo && currentRepo?.toLowerCase() === repo.toLowerCase();

            if (repo) {
                // If it's the current repo, don't auto-expand to a card
                if (isSameRepo) {
                    setType("link");
                    return;
                }
                // It's a repo
                setType("repo");
                setLoading(true);
                fetchRepoDetails(username, repo)
                    .then((repoData) => {
                        setData(repoData);
                    })
                    .catch(() => {
                        setError(true);
                        setType("link");
                    })
                    .finally(() => setLoading(false));
            } else {
                // If it's the current profile, don't auto-expand to a card
                if (isSameUser && !currentRepo) {
                    // Only skip if we are in profile chat (indicated by lack of currentRepo)
                    // or if explicitly on that profile page.
                    setType("link");
                    return;
                }
                // It's a profile
                setType("profile");
                setLoading(true);
                fetchProfile(username)
                    .then((profileData) => {
                        setData(profileData);
                    })
                    .catch(() => {
                        setError(true);
                        setType("link");
                    })
                    .finally(() => setLoading(false));
            }
        }
    }, [href]);

    if (type === "link" || error) {
        return (
            <a href={href} {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                {children}
            </a>
        );
    }

    if (loading) {
        return (
            <span className="inline-flex items-center gap-2 text-zinc-400 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading preview...
            </span>
        );
    }

    if (type === "profile" && data) {
        return (
            <div className="not-prose">
                <DeveloperCard
                    username={data.login}
                    name={data.name}
                    avatar={data.avatar_url}
                    bio={data.bio}
                    location={data.location || undefined}
                    blog={data.blog || undefined}
                />
            </div>
        );
    }

    if (type === "repo" && data) {
        return (
            <div className="not-prose">
                <RepoCard
                    name={data.name}
                    owner={data.owner.login}
                    description={data.description}
                    stars={data.stargazers_count}
                    forks={data.forks_count}
                    language={data.language}
                />
            </div>
        );
    }

    if (type === "preview") {
        return (
            <button
                onClick={(e) => {
                    e.preventDefault();
                    const filePath = href?.replace("#preview-", "");
                    if (filePath) {
                        window.dispatchEvent(new CustomEvent('open-file-preview', { detail: filePath }));
                    }
                }}
                className="text-purple-400 hover:text-purple-300 hover:underline inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 font-mono text-sm"
                title="Open file preview"
            >
                {children}
            </button>
        );
    }

    return (
        <a href={href} {...props} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}

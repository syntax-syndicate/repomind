import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kv } from "@vercel/kv";
import type { FixSession, ChangedFile, FixSessionSummary } from "@/lib/types/fix";
import type { SecurityFinding } from "@/lib/security-scanner";

const FIX_SESSION_TTL_SECONDS = 60 * 60;
function getFixSessionKey(sessionId: string): string {
    return `fix_session:${sessionId}`;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const body = await req.json() as {
            owner: string;
            repo: string;
            filePath: string;
            content: string;
            finding?: SecurityFinding;
            originalContent?: string;
        };

        if (!body.owner || !body.repo || !body.filePath || !body.content) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const sessionId = crypto.randomUUID();

        // Create a minimal ChangedFile object
        const changedFile: ChangedFile = {
            path: body.filePath,
            changeType: "modified",
            additions: 0, // We don't have a reliable diff here easily without a heavy library, 
            // but we can estimate or just show the 'after'
            deletions: 0,
            before: body.originalContent || "",
            after: body.content,
            unifiedDiff: "", // Will be empty or generated if needed
        };

        const summary: FixSessionSummary = {
            filesChanged: 1,
            additions: 0,
            deletions: 0,
        };

        // If no finding is provided (e.g. general improvement), create a placeholder
        const finding: SecurityFinding = body.finding || {
            title: "Chat Suggested Improvement",
            description: "An improvement or fix suggested during the chat conversation.",
            severity: "medium",
            file: body.filePath,
            type: "code",
            recommendation: "Review and apply the suggested changes.",
        };

        const fixSession: FixSession = {
            id: sessionId,
            scanId: "from-chat",
            findingIndex: -1,
            owner: body.owner,
            repo: body.repo,
            baseSha: "main", // Default to main, will be resolved or ignored in workspace
            patch: "",
            explanation: "Changes suggested via RepoMind AI chat.",
            files: [changedFile],
            summary,
            finding,
            chatHref: `/chat?q=${encodeURIComponent(`${body.owner}/${body.repo}`)}`,
            createdBy: session?.user?.id,
            createdAt: Date.now(),
        };

        await kv.setex(getFixSessionKey(sessionId), FIX_SESSION_TTL_SECONDS, fixSession);

        return NextResponse.json({ sessionId });
    } catch (error) {
        console.error("Error creating fix session from chat:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create fix session." },
            { status: 500 }
        );
    }
}

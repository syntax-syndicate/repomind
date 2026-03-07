import { kv } from "@vercel/kv";
import { Octokit } from "octokit";
import { buildFindingChatHref } from "@/lib/services/report-service";
import { getDefaultBranchHeadSha } from "@/lib/github";
import { generateSecurityPatch } from "@/lib/gemini-security";
import { getScanResult } from "@/lib/services/scan-storage";
import type {
    ChangedFile,
    FixPreviewResponse,
    FixSession,
    FixSessionSummary,
    PrCreateResponse,
    PrPrepareResponse,
} from "@/lib/types/fix";

const FIX_SESSION_TTL_SECONDS = 60 * 60;
const FIX_BRANCH_PREFIX = "repomind/fix";

type HunkLine = {
    kind: "context" | "add" | "del";
    text: string;
};

export type ParsedHunk = {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: HunkLine[];
};

export type ParsedPatchFile = {
    oldPath: string;
    newPath: string;
    hunks: ParsedHunk[];
    rawLines: string[];
};

function getFixSessionKey(sessionId: string): string {
    return `fix_session:${sessionId}`;
}

function normalizePatch(input: string): string {
    return input.replace(/\r\n/g, "\n").trim();
}

function parsePathFromMarker(marker: string): string {
    if (marker === "/dev/null") return marker;
    return marker.replace(/^a\//, "").replace(/^b\//, "");
}

export function parseUnifiedDiff(patch: string): ParsedPatchFile[] {
    const lines = normalizePatch(patch).split("\n");
    const files: ParsedPatchFile[] = [];

    let currentFile: ParsedPatchFile | null = null;
    let currentHunk: ParsedHunk | null = null;

    const finalizeHunk = () => {
        if (currentFile && currentHunk) {
            currentFile.hunks.push(currentHunk);
        }
        currentHunk = null;
    };

    const finalizeFile = () => {
        finalizeHunk();
        if (currentFile) {
            files.push(currentFile);
        }
        currentFile = null;
    };

    for (const line of lines) {
        if (line.startsWith("diff --git ")) {
            finalizeFile();
            currentFile = {
                oldPath: "",
                newPath: "",
                hunks: [],
                rawLines: [line],
            };
            continue;
        }

        if (line.startsWith("--- ")) {
            if (!currentFile) {
                currentFile = { oldPath: "", newPath: "", hunks: [], rawLines: [] };
            }
            finalizeHunk();
            currentFile.rawLines.push(line);
            currentFile.oldPath = parsePathFromMarker(line.slice(4).trim());
            continue;
        }

        if (line.startsWith("+++ ")) {
            if (!currentFile) {
                currentFile = { oldPath: "", newPath: "", hunks: [], rawLines: [] };
            }
            currentFile.rawLines.push(line);
            currentFile.newPath = parsePathFromMarker(line.slice(4).trim());
            continue;
        }

        const hunkHeaderMatch = /^@@\s*-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s*@@/.exec(line);
        if (hunkHeaderMatch) {
            if (!currentFile) {
                throw new Error("Malformed patch: hunk encountered before file header.");
            }
            finalizeHunk();
            currentFile.rawLines.push(line);
            currentHunk = {
                oldStart: Number(hunkHeaderMatch[1]),
                oldCount: Number(hunkHeaderMatch[2] || 1),
                newStart: Number(hunkHeaderMatch[3]),
                newCount: Number(hunkHeaderMatch[4] || 1),
                lines: [],
            };
            continue;
        }

        if (line.startsWith("\\ No newline at end of file")) {
            if (currentFile) currentFile.rawLines.push(line);
            continue;
        }

        if (currentHunk) {
            if (!currentFile) {
                throw new Error("Malformed patch: hunk line encountered without file.");
            }
            currentFile.rawLines.push(line);
            if (line.startsWith("+")) {
                currentHunk.lines.push({ kind: "add", text: line.slice(1) });
            } else if (line.startsWith("-")) {
                currentHunk.lines.push({ kind: "del", text: line.slice(1) });
            } else if (line.startsWith(" ")) {
                currentHunk.lines.push({ kind: "context", text: line.slice(1) });
            }
            continue;
        }

        if (currentFile) {
            currentFile.rawLines.push(line);
        }
    }

    finalizeFile();

    return files.filter((file) => file.oldPath || file.newPath);
}

export function applyHunksToContent(before: string, hunks: ParsedHunk[]): string {
    const beforeLines = before.length > 0 ? before.split("\n") : [];
    const afterLines: string[] = [];
    let cursor = 0;

    for (const hunk of hunks) {
        const targetIndex = Math.max(0, hunk.oldStart - 1);
        if (targetIndex < cursor) {
            throw new Error("Malformed patch: overlapping hunks are not supported.");
        }

        afterLines.push(...beforeLines.slice(cursor, targetIndex));
        cursor = targetIndex;

        for (const line of hunk.lines) {
            if (line.kind === "context") {
                const sourceLine = beforeLines[cursor] ?? "";
                afterLines.push(sourceLine);
                cursor += 1;
            } else if (line.kind === "del") {
                cursor += 1;
            } else {
                afterLines.push(line.text);
            }
        }
    }

    afterLines.push(...beforeLines.slice(cursor));
    return afterLines.join("\n");
}

async function fetchFileContentWithToken(
    owner: string,
    repo: string,
    path: string,
    accessToken?: string
): Promise<string> {
    const token = accessToken || process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error("No GitHub token available to fetch file content.");
    }

    const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch ${path}: ${res.status} ${text}`);
    }

    const data = await res.json() as { content?: string; encoding?: string };
    if (!data.content) return "";

    if (data.encoding === "base64") {
        return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return String(data.content);
}

function summarizeFiles(files: ChangedFile[]): FixSessionSummary {
    return files.reduce(
        (acc, file) => ({
            filesChanged: acc.filesChanged + 1,
            additions: acc.additions + file.additions,
            deletions: acc.deletions + file.deletions,
        }),
        { filesChanged: 0, additions: 0, deletions: 0 }
    );
}

function getSuggestedPrTitle(findingTitle: string): string {
    return `fix(security): ${findingTitle}`;
}

function getSuggestedPrBody(
    owner: string,
    repo: string,
    findingTitle: string,
    summary: FixSessionSummary
): string {
    return [
        `## Security Fix`,
        ``,
        `This PR addresses: **${findingTitle}**`,
        ``,
        `### Patch Summary`,
        `- Repository: \`${owner}/${repo}\``,
        `- Files changed: ${summary.filesChanged}`,
        `- Additions: +${summary.additions}`,
        `- Deletions: -${summary.deletions}`,
        ``,
        `Generated via RepoMind Fix Workspace.`,
    ].join("\n");
}

function sanitizeBranchSegment(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "security-fix";
}

async function resolveDefaultBranchHeadSha(
    owner: string,
    repo: string,
    accessToken?: string
): Promise<string> {
    if (!accessToken) {
        return getDefaultBranchHeadSha(owner, repo);
    }

    const octokit = new Octokit({ auth: accessToken });
    const repoRes = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoRes.data.default_branch || "main";
    const branchRes = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: defaultBranch,
    });
    return branchRes.data.commit.sha;
}

export async function createFixPreviewSession(params: {
    scanId: string;
    findingIndex: number;
    userId?: string;
    accessToken?: string;
}): Promise<FixPreviewResponse> {
    const scan = await getScanResult(params.scanId);
    if (!scan) {
        throw new Error("Scan not found.");
    }

    const finding = scan.findings[params.findingIndex];
    if (!finding) {
        throw new Error("Finding not found.");
    }

    const baseSha = await resolveDefaultBranchHeadSha(scan.owner, scan.repo, params.accessToken);

    const primaryFileContent = await fetchFileContentWithToken(
        scan.owner,
        scan.repo,
        finding.file,
        params.accessToken
    );

    const patchResult = await generateSecurityPatch({
        filePath: finding.file,
        fileContent: primaryFileContent,
        line: finding.line,
        description: finding.description,
        recommendation: finding.recommendation,
        snippet: finding.snippet,
    });

    const parsedFiles = parseUnifiedDiff(patchResult.patch);
    if (parsedFiles.length === 0) {
        throw new Error("Failed to parse patch into changed files.");
    }

    const changedFiles: ChangedFile[] = [];

    for (const parsedFile of parsedFiles) {
        const path = parsedFile.newPath !== "/dev/null" ? parsedFile.newPath : parsedFile.oldPath;
        if (!path || path === "/dev/null") {
            continue;
        }

        const changeType: ChangedFile["changeType"] =
            parsedFile.oldPath === "/dev/null" ? "added" :
                parsedFile.newPath === "/dev/null" ? "deleted" : "modified";

        const before =
            changeType === "added"
                ? ""
                : await fetchFileContentWithToken(scan.owner, scan.repo, path, params.accessToken);

        const after = changeType === "deleted" ? "" : applyHunksToContent(before, parsedFile.hunks);

        const additions = parsedFile.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.kind === "add").length,
            0
        );
        const deletions = parsedFile.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.kind === "del").length,
            0
        );

        changedFiles.push({
            path,
            changeType,
            additions,
            deletions,
            before,
            after,
            unifiedDiff: parsedFile.rawLines.join("\n"),
        });
    }

    if (changedFiles.length === 0) {
        throw new Error("No valid file changes were produced in the patch.");
    }

    const summary = summarizeFiles(changedFiles);
    const sessionId = crypto.randomUUID();
    const chatHref = buildFindingChatHref(scan.owner, scan.repo, finding);

    const session: FixSession = {
        id: sessionId,
        scanId: scan.id,
        findingIndex: params.findingIndex,
        owner: scan.owner,
        repo: scan.repo,
        baseSha,
        patch: patchResult.patch,
        explanation: patchResult.explanation,
        files: changedFiles,
        summary,
        finding,
        chatHref,
        createdBy: params.userId,
        createdAt: Date.now(),
    };

    await kv.setex(getFixSessionKey(sessionId), FIX_SESSION_TTL_SECONDS, session);

    return {
        sessionId,
        owner: scan.owner,
        repo: scan.repo,
        finding,
        explanation: patchResult.explanation,
        summary,
        files: changedFiles,
        chatHref,
        suggestedPrTitle: getSuggestedPrTitle(finding.title),
        suggestedPrBody: getSuggestedPrBody(scan.owner, scan.repo, finding.title, summary),
    };
}

export async function getFixSession(sessionId: string): Promise<FixSession | null> {
    return await kv.get<FixSession>(getFixSessionKey(sessionId));
}

function parseScopeList(scope: string | undefined): string[] {
    if (!scope) return [];
    return scope
        .split(/[,\s]+/)
        .map((part) => part.trim())
        .filter(Boolean);
}

async function resolveGrantedScopes(octokit: Octokit, sessionScope?: string): Promise<string[]> {
    const sessionScopes = parseScopeList(sessionScope);
    if (sessionScopes.length > 0) return sessionScopes;

    const response = await octokit.request("GET /user");
    const headerValue = response.headers["x-oauth-scopes"];
    if (typeof headerValue === "string") {
        return parseScopeList(headerValue);
    }
    return [];
}

export async function prepareFixPr(params: {
    session: FixSession;
    accessToken?: string;
    oauthScope?: string;
}): Promise<PrPrepareResponse> {
    if (!params.accessToken) {
        return {
            mode: "reauth_required",
            defaultBranch: "main",
            reauthReason: "GitHub access token not found.",
        };
    }

    const octokit = new Octokit({ auth: params.accessToken });
    const grantedScopes = await resolveGrantedScopes(octokit, params.oauthScope);
    const hasRepoScope = grantedScopes.includes("repo");
    if (!hasRepoScope) {
        return {
            mode: "reauth_required",
            defaultBranch: "main",
            reauthReason: "Repo write scope is required to create PRs.",
        };
    }

    const [meRes, repoRes] = await Promise.all([
        octokit.rest.users.getAuthenticated(),
        octokit.rest.repos.get({ owner: params.session.owner, repo: params.session.repo }),
    ]);

    const repoData = repoRes.data as { default_branch: string; permissions?: { push?: boolean } };
    const canPush = Boolean(repoData.permissions?.push);

    if (canPush) {
        return {
            mode: "same_repo",
            defaultBranch: repoData.default_branch || "main",
            userLogin: meRes.data.login,
        };
    }

    let hasExistingFork = false;
    try {
        await octokit.rest.repos.get({ owner: meRes.data.login, repo: params.session.repo });
        hasExistingFork = true;
    } catch {
        hasExistingFork = false;
    }

    return {
        mode: "fork_required",
        defaultBranch: repoData.default_branch || "main",
        userLogin: meRes.data.login,
        forkOwner: meRes.data.login,
        hasExistingFork,
    };
}

async function ensureUserFork(
    octokit: Octokit,
    upstreamOwner: string,
    upstreamRepo: string,
    userLogin: string
): Promise<{ owner: string; repo: string }> {
    try {
        await octokit.rest.repos.get({ owner: userLogin, repo: upstreamRepo });
        return { owner: userLogin, repo: upstreamRepo };
    } catch {
        await octokit.rest.repos.createFork({ owner: upstreamOwner, repo: upstreamRepo });
    }

    for (let attempt = 0; attempt < 15; attempt += 1) {
        try {
            await octokit.rest.repos.get({ owner: userLogin, repo: upstreamRepo });
            return { owner: userLogin, repo: upstreamRepo };
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
    }

    throw new Error("Fork creation timed out. Please try again.");
}

async function createBranchFromBase(params: {
    octokit: Octokit;
    owner: string;
    repo: string;
    baseBranch: string;
    branchNameSeed: string;
}): Promise<{ branchName: string; baseSha: string; treeSha: string }> {
    const branchRes = await params.octokit.rest.repos.getBranch({
        owner: params.owner,
        repo: params.repo,
        branch: params.baseBranch,
    });
    const baseSha = branchRes.data.commit.sha;
    const commitRes = await params.octokit.rest.git.getCommit({
        owner: params.owner,
        repo: params.repo,
        commit_sha: baseSha,
    });

    const seed = sanitizeBranchSegment(params.branchNameSeed);
    let branchName = `${FIX_BRANCH_PREFIX}/${seed}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await params.octokit.rest.git.createRef({
                owner: params.owner,
                repo: params.repo,
                ref: `refs/heads/${branchName}`,
                sha: baseSha,
            });
            return { branchName, baseSha, treeSha: commitRes.data.tree.sha };
        } catch {
            branchName = `${FIX_BRANCH_PREFIX}/${seed}-${Date.now()}`;
        }
    }

    throw new Error("Failed to create branch for PR.");
}

export async function createPrFromFixSession(params: {
    session: FixSession;
    accessToken: string;
    oauthScope?: string;
    title: string;
    body: string;
    baseBranch?: string;
    useFork?: boolean;
}): Promise<PrCreateResponse> {
    if (params.session.files.some((file) => file.changeType === "deleted")) {
        throw new Error("Deleted-file patches are not supported for PR creation yet.");
    }

    const octokit = new Octokit({ auth: params.accessToken });
    const scopes = await resolveGrantedScopes(octokit, params.oauthScope);
    if (!scopes.includes("repo")) {
        throw new Error("Repo scope is required before creating PR.");
    }

    const meRes = await octokit.rest.users.getAuthenticated();
    const userLogin = meRes.data.login;

    const upstreamRepo = await octokit.rest.repos.get({
        owner: params.session.owner,
        repo: params.session.repo,
    });
    const upstream = upstreamRepo.data as { default_branch: string; permissions?: { push?: boolean } };
    const defaultBranch = params.baseBranch || upstream.default_branch || "main";

    let headOwner = params.session.owner;
    let headRepo = params.session.repo;

    if (params.useFork || !upstream.permissions?.push) {
        const fork = await ensureUserFork(octokit, params.session.owner, params.session.repo, userLogin);
        headOwner = fork.owner;
        headRepo = fork.repo;
    }

    const { branchName, treeSha, baseSha } = await createBranchFromBase({
        octokit,
        owner: headOwner,
        repo: headRepo,
        baseBranch: defaultBranch,
        branchNameSeed: params.session.finding.title,
    });

    const treeEntries: Array<{
        path: string;
        mode: "100644";
        type: "blob";
        sha: string | null;
    }> = [];

    for (const file of params.session.files) {
        if (file.changeType === "deleted") {
            treeEntries.push({
                path: file.path,
                mode: "100644",
                type: "blob",
                sha: null,
            });
            continue;
        }

        const blobRes = await octokit.rest.git.createBlob({
            owner: headOwner,
            repo: headRepo,
            content: file.after,
            encoding: "utf-8",
        });

        treeEntries.push({
            path: file.path,
            mode: "100644",
            type: "blob",
            sha: blobRes.data.sha,
        });
    }

    const treeRes = await octokit.rest.git.createTree({
        owner: headOwner,
        repo: headRepo,
        base_tree: treeSha,
        tree: treeEntries,
    });

    const commitRes = await octokit.rest.git.createCommit({
        owner: headOwner,
        repo: headRepo,
        message: params.title,
        tree: treeRes.data.sha,
        parents: [baseSha],
    });

    await octokit.rest.git.updateRef({
        owner: headOwner,
        repo: headRepo,
        ref: `heads/${branchName}`,
        sha: commitRes.data.sha,
        force: true,
    });

    const head = headOwner === params.session.owner
        ? branchName
        : `${userLogin}:${branchName}`;

    const prRes = await octokit.rest.pulls.create({
        owner: params.session.owner,
        repo: params.session.repo,
        title: params.title,
        body: params.body,
        head,
        base: defaultBranch,
    });

    return {
        prUrl: prRes.data.html_url,
        prNumber: prRes.data.number,
        headRepo: `${headOwner}/${headRepo}`,
        headBranch: branchName,
    };
}

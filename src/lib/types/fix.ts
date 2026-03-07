import type { SecurityFinding } from "@/lib/security-scanner";

export type FixIntent = "chat" | "pr";
export type DiffViewMode = "unified" | "before" | "after";
export type ChangeType = "modified" | "added" | "deleted";

export interface ChangedFile {
    path: string;
    changeType: ChangeType;
    additions: number;
    deletions: number;
    before: string;
    after: string;
    unifiedDiff: string;
}

export interface FixSessionSummary {
    filesChanged: number;
    additions: number;
    deletions: number;
}

export interface FixSession {
    id: string;
    scanId: string;
    findingIndex: number;
    owner: string;
    repo: string;
    baseSha: string;
    patch: string;
    explanation: string;
    files: ChangedFile[];
    summary: FixSessionSummary;
    finding: SecurityFinding;
    chatHref: string;
    createdBy?: string;
    createdAt: number;
}

export interface FixPreviewResponse {
    sessionId: string;
    owner: string;
    repo: string;
    finding: SecurityFinding;
    explanation: string;
    summary: FixSessionSummary;
    files: ChangedFile[];
    chatHref: string;
    suggestedPrTitle: string;
    suggestedPrBody: string;
}

export interface PrPrepareResponse {
    mode: "same_repo" | "fork_required" | "reauth_required";
    defaultBranch: string;
    userLogin?: string;
    forkOwner?: string;
    hasExistingFork?: boolean;
    reauthReason?: string;
}

export interface PrCreateResponse {
    prUrl: string;
    prNumber: number;
    headRepo: string;
    headBranch: string;
}

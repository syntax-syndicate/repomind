import { kv } from "@vercel/kv";
import type { SecurityFinding, ScanSummary } from "@/lib/security-scanner";

export interface StoredScan {
    id: string;
    owner: string;
    repo: string;
    timestamp: number;
    depth: "quick" | "deep";
    summary: ScanSummary;
    findings: SecurityFinding[];
    userId?: string;
}

const getRepoScansListKey = (owner: string, repo: string) => `repo:${owner}:${repo}:scans`;

export async function saveScanResult(
    owner: string,
    repo: string,
    data: {
        depth: "quick" | "deep";
        summary: ScanSummary;
        findings: SecurityFinding[];
    },
    userId?: string
): Promise<string> {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    const record: StoredScan = {
        id,
        owner,
        repo,
        timestamp,
        userId,
        ...data,
    };

    // Save the record
    await kv.set(`scan:${id}`, record);
    // Update the latest pointer
    await kv.set(`latest_scan:${owner}:${repo}`, id);
    // Keep a short scan history list per repository to support report comparisons
    await kv.lpush(getRepoScansListKey(owner, repo), id);
    await kv.ltrim(getRepoScansListKey(owner, repo), 0, 199);

    if (userId) {
        // Add to user's recent scans list (keep only last 50 for now)
        await kv.lpush(`user:${userId}:scans`, id);
        await kv.ltrim(`user:${userId}:scans`, 0, 49);
    }

    return id;
}

export async function getScanResult(id: string): Promise<StoredScan | null> {
    return await kv.get<StoredScan>(`scan:${id}`);
}

export async function getLatestScanId(owner: string, repo: string): Promise<string | null> {
    return await kv.get<string>(`latest_scan:${owner}:${repo}`);
}

export async function getPreviousScan(
    owner: string,
    repo: string,
    currentScanId: string,
    currentTimestamp?: number
): Promise<StoredScan | null> {
    let resolvedTimestamp = currentTimestamp;

    if (typeof resolvedTimestamp !== "number") {
        const current = await getScanResult(currentScanId);
        if (!current) return null;
        resolvedTimestamp = current.timestamp;
    }

    const repoScanIds = await kv.lrange<string>(getRepoScansListKey(owner, repo), 0, 50);
    if (repoScanIds.length > 0) {
        const candidateScans = await Promise.all(
            repoScanIds
                .filter((id) => id !== currentScanId)
                .map((id) => getScanResult(id))
        );

        const previous = candidateScans
            .filter((scan): scan is StoredScan => Boolean(scan))
            .filter((scan) => scan.owner === owner && scan.repo === repo && scan.timestamp < resolvedTimestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        if (previous) {
            return previous;
        }
    }

    // Fallback for older scans created before repo-level list tracking existed.
    const scanKeys = await kv.keys("scan:*");
    if (scanKeys.length === 0) return null;

    const allScans = await Promise.all(
        scanKeys.map((key) => kv.get<StoredScan>(key))
    );

    return allScans
        .filter((scan): scan is StoredScan => Boolean(scan))
        .filter((scan) => scan.id !== currentScanId)
        .filter((scan) => scan.owner === owner && scan.repo === repo)
        .filter((scan) => scan.timestamp < resolvedTimestamp)
        .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
}

export async function getUserScans(userId: string, limit?: number): Promise<StoredScan[]> {
    const end = typeof limit === "number" && limit > 0 ? limit - 1 : -1;
    const scanIds = await kv.lrange(`user:${userId}:scans`, 0, end);
    const scans = await Promise.all(scanIds.map(id => getScanResult(id)));
    return scans.filter((s): s is StoredScan => s !== null);
}

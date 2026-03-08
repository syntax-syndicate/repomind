import { prisma } from "@/lib/db";
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

function mapStoredScan(record: {
    id: string;
    owner: string;
    repo: string;
    timestamp: bigint;
    depth: string;
    summary: unknown;
    findings: unknown;
    userId: string | null;
}): StoredScan {
    return {
        id: record.id,
        owner: record.owner,
        repo: record.repo,
        timestamp: Number(record.timestamp),
        depth: record.depth === "deep" ? "deep" : "quick",
        summary: record.summary as ScanSummary,
        findings: record.findings as SecurityFinding[],
        userId: record.userId ?? undefined,
    };
}

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

    await prisma.repoScan.create({
        data: {
            id: record.id,
            owner: record.owner,
            repo: record.repo,
            timestamp: BigInt(record.timestamp),
            depth: record.depth,
            summary: record.summary as object,
            findings: record.findings as unknown as object[],
            userId: record.userId ?? null,
        },
    });

    return id;
}

export async function getScanResult(id: string): Promise<StoredScan | null> {
    const record = await prisma.repoScan.findUnique({ where: { id } });
    return record ? mapStoredScan(record) : null;
}

export async function getLatestScanId(owner: string, repo: string): Promise<string | null> {
    const latest = await prisma.repoScan.findFirst({
        where: { owner, repo },
        orderBy: { timestamp: "desc" },
        select: { id: true },
    });
    return latest?.id ?? null;
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

    const previous = await prisma.repoScan.findFirst({
        where: {
            owner,
            repo,
            id: { not: currentScanId },
            timestamp: { lt: BigInt(resolvedTimestamp) },
        },
        orderBy: { timestamp: "desc" },
    });

    return previous ? mapStoredScan(previous) : null;
}

export async function getUserScans(userId: string, limit?: number): Promise<StoredScan[]> {
    const scans = await prisma.repoScan.findMany({
        where: { userId },
        orderBy: { timestamp: "desc" },
        ...(typeof limit === "number" && limit > 0 ? { take: limit } : {}),
    });
    return scans.map(mapStoredScan);
}

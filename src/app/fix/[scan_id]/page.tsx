import { notFound } from "next/navigation";
import { getScanResult } from "@/lib/services/scan-storage";
import { FixWorkspace } from "./FixWorkspace";
import type { FixIntent } from "@/lib/types/fix";

export default async function FixWorkspacePage({
    params,
    searchParams,
}: {
    params: Promise<{ scan_id: string }>;
    searchParams: Promise<{ finding?: string; intent?: string; sessionId?: string }>;
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const scan = await getScanResult(resolvedParams.scan_id);
    if (!scan) {
        notFound();
    }

    const findingIndexRaw = Number.parseInt(resolvedSearchParams.finding ?? "0", 10);
    const findingIndex = Number.isInteger(findingIndexRaw) && findingIndexRaw >= 0 ? findingIndexRaw : 0;
    const intent = resolvedSearchParams.intent === "pr" ? "pr" : "chat";

    return (
        <FixWorkspace
            scanId={scan.id}
            owner={scan.owner}
            repo={scan.repo}
            findingIndex={findingIndex}
            intent={intent as FixIntent}
            sessionId={resolvedSearchParams.sessionId}
        />
    );
}

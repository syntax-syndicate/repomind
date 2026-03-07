import { auth } from "@/lib/auth";
import { getUserScans } from "@/lib/services/scan-storage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const limitParam = request.nextUrl.searchParams.get("limit");
        const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
        const limit = typeof parsedLimit === "number" && Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(parsedLimit, 50)
            : undefined;
        const scans = await getUserScans(session.user.id, limit);
        return NextResponse.json({ scans });
    } catch {
        return NextResponse.json({ error: "Failed to fetch scans" }, { status: 500 });
    }
}

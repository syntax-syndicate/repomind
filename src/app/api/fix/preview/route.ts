import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createFixPreviewSession } from "@/lib/services/fix-service";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { scanId?: string; findingIndex?: number };
        if (!body.scanId || typeof body.findingIndex !== "number") {
            return NextResponse.json({ error: "scanId and findingIndex are required." }, { status: 400 });
        }

        const session = await auth();
        const response = await createFixPreviewSession({
            scanId: body.scanId,
            findingIndex: body.findingIndex,
            userId: session?.user?.id,
            accessToken: (session as { accessToken?: string } | null)?.accessToken,
        });

        return NextResponse.json(response);
    } catch (error) {
        console.error("fix preview error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate fix preview." },
            { status: 500 }
        );
    }
}

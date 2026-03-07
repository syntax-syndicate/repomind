import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFixSession } from "@/lib/services/fix-service";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ session_id: string }> }
) {
    try {
        const resolvedParams = await params;
        const session = await getFixSession(resolvedParams.session_id);
        if (!session) {
            return NextResponse.json({ error: "Fix session not found." }, { status: 404 });
        }

        const user = await auth();
        if (session.createdBy && session.createdBy !== user?.user?.id) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        return NextResponse.json(session);
    } catch (error) {
        console.error("fix session fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch fix session." }, { status: 500 });
    }
}

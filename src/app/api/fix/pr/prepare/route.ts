import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFixSession, prepareFixPr } from "@/lib/services/fix-service";

export async function POST(req: NextRequest) {
    try {
        const userSession = await auth();
        if (!userSession?.user?.id) {
            return NextResponse.json({ error: "Authentication required." }, { status: 401 });
        }

        const body = await req.json() as { sessionId?: string };
        if (!body.sessionId) {
            return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
        }

        const fixSession = await getFixSession(body.sessionId);
        if (!fixSession) {
            return NextResponse.json({ error: "Fix session not found." }, { status: 404 });
        }
        if (fixSession.createdBy && fixSession.createdBy !== userSession.user.id) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        const result = await prepareFixPr({
            session: fixSession,
            accessToken: (userSession as { accessToken?: string }).accessToken,
            oauthScope: (userSession as { oauthScope?: string }).oauthScope,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("fix pr prepare error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to prepare PR flow." },
            { status: 500 }
        );
    }
}

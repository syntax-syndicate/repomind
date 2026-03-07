import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPrFromFixSession, getFixSession } from "@/lib/services/fix-service";

export async function POST(req: NextRequest) {
    try {
        const userSession = await auth();
        if (!userSession?.user?.id) {
            return NextResponse.json({ error: "Authentication required." }, { status: 401 });
        }

        const body = await req.json() as {
            sessionId?: string;
            title?: string;
            body?: string;
            baseBranch?: string;
            useFork?: boolean;
        };

        if (!body.sessionId || !body.title) {
            return NextResponse.json({ error: "sessionId and title are required." }, { status: 400 });
        }

        const fixSession = await getFixSession(body.sessionId);
        if (!fixSession) {
            return NextResponse.json({ error: "Fix session not found." }, { status: 404 });
        }
        if (fixSession.createdBy && fixSession.createdBy !== userSession.user.id) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        const accessToken = (userSession as { accessToken?: string }).accessToken;
        if (!accessToken) {
            return NextResponse.json({ error: "GitHub token missing. Re-auth required." }, { status: 401 });
        }

        const result = await createPrFromFixSession({
            session: fixSession,
            accessToken,
            oauthScope: (userSession as { oauthScope?: string }).oauthScope,
            title: body.title,
            body: body.body || "",
            baseBranch: body.baseBranch,
            useFork: Boolean(body.useFork),
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("fix pr create error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create PR." },
            { status: 500 }
        );
    }
}

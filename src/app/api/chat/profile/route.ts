import { NextRequest } from "next/server";
import { processProfileQueryStream } from "@/app/actions";
import type { StreamUpdate } from "@/lib/streaming-types";

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();
    try {
        const body = await req.json();
        const { query, profileContext, modelPreference } = body;

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const generator = processProfileQueryStream(query, profileContext, modelPreference);
                    for await (const chunk of generator) {
                        // Serialize chunk to JSON and add newline for framing
                        const data = JSON.stringify(chunk) + "\n";
                        controller.enqueue(encoder.encode(data));
                    }
                    controller.close();
                } catch (error: any) {
                    console.error("Stream generation error:", error);
                    const errorObj: StreamUpdate = { type: "error", message: error.message || "An error occurred during streaming." };
                    controller.enqueue(encoder.encode(JSON.stringify(errorObj) + "\n"));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (error: any) {
        console.error("API route error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

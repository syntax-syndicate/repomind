import { describe, expect, it, vi, beforeEach } from "vitest";
import { gzipSync } from "node:zlib";

const { setexMock, getMock } = vi.hoisted(() => ({
    setexMock: vi.fn(),
    getMock: vi.fn(),
}));

vi.mock("@vercel/kv", () => ({
    kv: {
        setex: setexMock,
        get: getMock,
    },
}));

import { cacheSecurityScanResult, getCachedSecurityScanResult } from "@/lib/cache";

describe("security scan cache helpers", () => {
    beforeEach(() => {
        setexMock.mockReset();
        getMock.mockReset();
    });

    it("stores scan results with 1-hour TTL and revision-aware key", async () => {
        setexMock.mockResolvedValue("OK");

        await cacheSecurityScanResult(
            "acme",
            "widget",
            "security_scan_quick_true",
            ["src/b.ts", "src/a.ts"],
            "abc123",
            { findings: [], summary: { total: 0 } }
        );

        expect(setexMock).toHaveBeenCalledTimes(1);
        const [key, ttl] = setexMock.mock.calls[0];
        expect(key).toContain("scan_answer:acme/widget:security_scan_quick_true:abc123:");
        expect(ttl).toBe(3600);
    });

    it("reads back and parses cached scan JSON", async () => {
        const payload = JSON.stringify({ ok: true, total: 2 });
        const compressed = gzipSync(Buffer.from(payload));
        getMock.mockResolvedValue(`gz:${compressed.toString("base64")}`);

        const result = await getCachedSecurityScanResult(
            "acme",
            "widget",
            "security_scan_quick_true",
            ["src/a.ts"],
            "abc123"
        );

        expect(result).toEqual({ ok: true, total: 2 });
    });
});

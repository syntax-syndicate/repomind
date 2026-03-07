import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredScan } from "@/lib/services/scan-storage";

const { lrangeMock, getMock, keysMock } = vi.hoisted(() => ({
    lrangeMock: vi.fn(),
    getMock: vi.fn(),
    keysMock: vi.fn(),
}));

vi.mock("@vercel/kv", () => ({
    kv: {
        lrange: lrangeMock,
        get: getMock,
        keys: keysMock,
        set: vi.fn(),
        lpush: vi.fn(),
        ltrim: vi.fn(),
    },
}));

import { getPreviousScan } from "@/lib/services/scan-storage";

function buildScan(overrides: Partial<StoredScan>): StoredScan {
    return {
        id: "scan-id",
        owner: "acme",
        repo: "widget",
        timestamp: 1000,
        depth: "quick",
        summary: {
            total: 1,
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
            info: 0,
        },
        findings: [],
        ...overrides,
    };
}

describe("getPreviousScan", () => {
    beforeEach(() => {
        lrangeMock.mockReset();
        getMock.mockReset();
        keysMock.mockReset();
    });

    it("returns previous scan from repo index list when available", async () => {
        lrangeMock.mockResolvedValue(["current", "older-a", "older-b"]);

        const store: Record<string, StoredScan> = {
            "scan:older-a": buildScan({ id: "older-a", timestamp: 1700 }),
            "scan:older-b": buildScan({ id: "older-b", timestamp: 1600 }),
        };

        getMock.mockImplementation(async (key: string) => store[key] ?? null);

        const result = await getPreviousScan("acme", "widget", "current", 1800);
        expect(result?.id).toBe("older-a");
    });

    it("falls back to full scan key search when repo index has no entries", async () => {
        lrangeMock.mockResolvedValue([]);
        keysMock.mockResolvedValue(["scan:x", "scan:y", "scan:z"]);

        const store: Record<string, StoredScan> = {
            "scan:x": buildScan({ id: "x", owner: "acme", repo: "widget", timestamp: 1300 }),
            "scan:y": buildScan({ id: "y", owner: "acme", repo: "widget", timestamp: 1900 }),
            "scan:z": buildScan({ id: "z", owner: "other", repo: "repo", timestamp: 1500 }),
        };
        getMock.mockImplementation(async (key: string) => store[key] ?? null);

        const result = await getPreviousScan("acme", "widget", "current", 2000);
        expect(result?.id).toBe("y");
    });
});

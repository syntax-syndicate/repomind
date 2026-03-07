import { describe, expect, it } from "vitest";
import type { SecurityFinding } from "@/lib/security-scanner";
import type { StoredScan } from "@/lib/services/scan-storage";
import {
    buildReportViewData,
    computePriorScanDiff,
    findingFingerprint,
    rankFindingsForTriage,
} from "@/lib/services/report-service";

function makeFinding(overrides: Partial<SecurityFinding>): SecurityFinding {
    return {
        type: "code",
        severity: "medium",
        title: "Potential SQL Injection",
        description: "User-controlled input reaches a SQL string concatenation sink.",
        file: "src/api/users.ts",
        recommendation: "Use parameterized queries.",
        ...overrides,
    };
}

describe("findingFingerprint", () => {
    it("normalizes casing and whitespace for deterministic matching", () => {
        const a = makeFinding({
            title: "  Potential   SQL Injection ",
            description: "User-controlled input reaches a SQL string concatenation sink.",
        });
        const b = makeFinding({
            title: "potential sql injection",
            description: "  user-controlled input reaches a sql string concatenation sink. ",
        });

        expect(findingFingerprint(a)).toBe(findingFingerprint(b));
    });
});

describe("computePriorScanDiff", () => {
    it("computes new/resolved/unchanged counts", () => {
        const shared = makeFinding({});
        const resolved = makeFinding({ file: "src/legacy.ts", title: "Unsafe eval() usage" });
        const added = makeFinding({ file: "src/new.ts", title: "Hardcoded Secret" });

        const diff = computePriorScanDiff([shared, added], [shared, resolved]);
        expect(diff).toEqual({ new: 1, resolved: 1, unchanged: 1 });
    });

    it("treats all current findings as new when no previous scan exists", () => {
        const current = [makeFinding({}), makeFinding({ file: "src/auth.ts", title: "Auth Bypass" })];
        const diff = computePriorScanDiff(current, null);
        expect(diff).toEqual({ new: 2, resolved: 0, unchanged: 0 });
    });
});

describe("rankFindingsForTriage", () => {
    it("prioritizes high-severity/high-confidence exploitable findings first", () => {
        const critical = makeFinding({
            severity: "critical",
            confidence: "high",
            title: "Command Injection",
            description: "Unsanitized shell command execution",
            file: "src/api/admin.ts",
        });
        const medium = makeFinding({
            severity: "medium",
            confidence: "high",
            title: "Potential XSS",
            description: "Potential reflected XSS",
            file: "src/ui/render.tsx",
        });
        const low = makeFinding({
            severity: "low",
            confidence: "medium",
            title: "Info leak",
            file: "src/log.ts",
        });

        const ranked = rankFindingsForTriage([medium, low, critical]);
        expect(ranked[0]).toBe(critical);
        expect(ranked[2]).toBe(low);
    });
});

describe("buildReportViewData", () => {
    it("returns top fixes, diff summary, and finding action payloads", () => {
        const scan: StoredScan = {
            id: "scan-1",
            owner: "acme",
            repo: "widget",
            timestamp: Date.now(),
            depth: "quick",
            summary: {
                total: 2,
                critical: 1,
                high: 0,
                medium: 1,
                low: 0,
                info: 0,
            },
            findings: [
                makeFinding({ severity: "critical", confidence: "high", title: "Hardcoded Secret" }),
                makeFinding({ severity: "medium", confidence: "medium", title: "Potential XSS", file: "src/ui.tsx" }),
            ],
        };

        const previous: StoredScan = {
            ...scan,
            id: "scan-0",
            findings: [makeFinding({ severity: "critical", confidence: "high", title: "Hardcoded Secret" })],
        };

        const view = buildReportViewData(scan, previous);
        expect(view.topFixes.length).toBe(2);
        expect(view.priorScanDiff).toEqual({ new: 1, resolved: 0, unchanged: 1 });
        expect(view.findingActions.length).toBe(2);
        expect(view.findingActions[0].chatHref).toContain("/chat?q=acme%2Fwidget");
        expect(view.findingActions[0].chatPrompt).toContain("Help me fix this security vulnerability");
    });
});

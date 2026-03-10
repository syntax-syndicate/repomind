import { describe, expect, it } from "vitest";

import type { SecurityFinding } from "@/lib/security-scanner";
import { verifyDetectedFindings } from "@/lib/services/security-verification";

function makeCodeFinding(overrides: Partial<SecurityFinding> = {}): SecurityFinding {
    return {
        type: "code",
        severity: "high",
        title: "SQL injection via tainted query construction",
        description: "Tainted input reaches query sink.",
        file: "src/api/user.ts",
        line: 42,
        recommendation: "Use parameterized queries.",
        cwe: "CWE-89",
        confidence: "high",
        confidenceScore: 0.9,
        evidence: [
            { type: "source", message: "req.query.id controls variable", line: 40 },
            { type: "sink", message: "db.query receives dynamic template", line: 42 },
        ],
        ...overrides,
    };
}

describe("security verification gate", () => {
    it("verifies strong source-to-sink findings as true positives", async () => {
        const finding = makeCodeFinding({
            recommendation: "Use query placeholders and strict validation.",
        });
        const result = await verifyDetectedFindings({
            scanId: "scan_1",
            owner: "acme",
            repo: "widget",
            findings: [finding],
        });

        expect(result.verifiedFindings).toHaveLength(1);
        expect(result.hiddenFindings).toHaveLength(0);
        expect(result.rejectedFindings).toHaveLength(0);
        expect(result.records[0]?.verificationStatus).toBe("AUTO_VERIFIED_TRUE");
        expect(result.records[0]?.gateDecision).toBe("include");
    });

    it("rejects injection findings when sanitizer signal is present", async () => {
        const finding = makeCodeFinding({
            snippet: "const id = sanitize(req.query.id); db.query(`SELECT ... ${id}`)",
            evidence: [
                { type: "source", message: "req.query.id controls variable", line: 40 },
                { type: "sink", message: "db.query receives dynamic template", line: 42 },
                { type: "sanitizer", message: "sanitize() applied", line: 41 },
            ],
        });

        const result = await verifyDetectedFindings({
            scanId: "scan_2",
            owner: "acme",
            repo: "widget",
            findings: [finding],
        });

        expect(result.verifiedFindings).toHaveLength(0);
        expect(result.rejectedFindings).toHaveLength(1);
        expect(result.records[0]?.verificationStatus).toBe("AUTO_REJECTED_FALSE");
        expect(result.records[0]?.gateDecision).toBe("exclude");
    });

    it("hides inconclusive findings from report output", async () => {
        const weak = makeCodeFinding({
            type: "configuration",
            severity: "medium",
            title: "Insecure HTTP Endpoint in Config",
            description: "A service URL uses HTTP instead of HTTPS.",
            file: "config/service.env",
            recommendation: "Use HTTPS service URLs in production.",
            confidence: "low",
            confidenceScore: 0.5,
            evidence: [{ type: "context", message: "detector matched API_URL=http://..." }],
        });

        const result = await verifyDetectedFindings({
            scanId: "scan_3",
            owner: "acme",
            repo: "widget",
            findings: [weak],
        });

        expect(result.verifiedFindings).toHaveLength(0);
        expect(result.hiddenFindings).toHaveLength(1);
        expect(result.records[0]?.verificationStatus).toBe("INCONCLUSIVE_HIDDEN");
    });
});

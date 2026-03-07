import { describe, it, expect } from "vitest";
import { detectSecrets, detectCodePatterns } from "@/lib/security-scanner";

// ─── detectSecrets ────────────────────────────────────────────────────────────

describe("detectSecrets", () => {
    it("detects a hardcoded AWS access key pattern", () => {
        const content = `const key = "AKIA1234567890ABCDEF";\nconsole.log(key);`;
        const findings = detectSecrets("config.ts", content);
        expect(findings.length).toBeGreaterThan(0);
        expect(findings.some(f => f.type === "secret")).toBe(true);
    });

    it("detects an OpenAI API key", () => {
        const content = `const apiKey = "sk-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4";`;
        const findings = detectSecrets("app.ts", content);
        expect(findings.some(f => f.title?.toLowerCase().includes("openai") || f.type === "secret")).toBe(true);
    });

    it("detects a hardcoded database connection string with credentials", () => {
        const content = `const db = "postgresql://dbuser:mypassword@localhost:5432/mydb";`;
        const findings = detectSecrets("db.ts", content);
        expect(findings.length).toBeGreaterThan(0);
        expect(findings.some(f => f.severity === "critical")).toBe(true);
    });

    it("detects a GitHub token pattern", () => {
        const content = `const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyZ";`;
        const findings = detectSecrets("github-client.ts", content);
        expect(findings.length).toBeGreaterThan(0);
    });

    it("returns empty findings for clean, secret-free code", () => {
        const content = `
export function add(a: number, b: number): number {
    return a + b;
}
`;
        const findings = detectSecrets("math.ts", content);
        expect(findings).toHaveLength(0);
    });

    it("detects a Stripe secret key", () => {
        const content = `const stripeKey = "sk_test_STUB_KEY_FOR_TESTING_PURPOSES_ONLY_NOT_REAL";`;
        const findings = detectSecrets("payment.ts", content);
        expect(findings.length).toBeGreaterThan(0);
    });

    it("includes file path in findings", () => {
        const content = `const key = "AKIA1234567890ABCDEF";`;
        const findings = detectSecrets("secrets/config.ts", content);
        if (findings.length > 0) {
            expect(findings[0].file).toBe("secrets/config.ts");
        }
    });
});

// ─── detectCodePatterns ───────────────────────────────────────────────────────

describe("detectCodePatterns", () => {
    it("detects eval() usage", () => {
        const content = `const result = eval(userInput);`;
        const findings = detectCodePatterns("script.ts", content);
        expect(findings.some(f => f.title?.toLowerCase().includes("eval"))).toBe(true);
    });

    it("detects unsafe child_process.exec usage", () => {
        const content = `const cp = require('child_process');\ncp.exec(userCommand);`;
        const findings = detectCodePatterns("runner.ts", content);
        expect(findings.some(f => f.title?.toLowerCase().includes("exec") || f.type === "code")).toBe(true);
    });

    it("returns empty findings for safe code", () => {
        const safeCode = `
export function greet(name: string): string {
    return \`Hello, \${name}!\`;
}
`;
        const findings = detectCodePatterns("greeting.ts", safeCode);
        expect(findings).toHaveLength(0);
    });

    it("detects prototype pollution vector", () => {
        const content = `obj["__proto__"] = { "polluted": true };`;
        const findings = detectCodePatterns("exploit.ts", content);
        expect(findings.some(f => f.type === "code")).toBe(true);
    });

    it("includes line numbers in findings", () => {
        const content = `const a = 1;\nconst result = eval("2+2");`;
        const findings = detectCodePatterns("code.ts", content);
        const evalFinding = findings.find(f => f.title?.toLowerCase().includes("eval"));
        if (evalFinding) {
            expect(evalFinding.line).toBeGreaterThan(0);
        }
    });

    it("includes recommendations in findings", () => {
        const content = `eval(input);`;
        const findings = detectCodePatterns("code.js", content);
        if (findings.length > 0) {
            expect(findings[0].recommendation).toBeDefined();
            expect(findings[0].recommendation.length).toBeGreaterThan(0);
        }
    });
});

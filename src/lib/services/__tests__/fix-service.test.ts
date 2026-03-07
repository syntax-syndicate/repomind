import { describe, expect, it } from "vitest";
import { applyHunksToContent, parseUnifiedDiff } from "@/lib/services/fix-service";

describe("parseUnifiedDiff", () => {
    it("parses multi-file unified diffs with hunks", () => {
        const patch = `
diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 console.log(a);
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,2 +1,2 @@
-const x = "old";
+const x = "new";
 export { x };
`.trim();

        const parsed = parseUnifiedDiff(patch);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].newPath).toBe("src/a.ts");
        expect(parsed[1].newPath).toBe("src/b.ts");
        expect(parsed[0].hunks[0].lines.some((line) => line.kind === "add")).toBe(true);
    });
});

describe("applyHunksToContent", () => {
    it("reconstructs after-content from before text and parsed hunks", () => {
        const patch = `
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 console.log(a);
`.trim();

        const parsed = parseUnifiedDiff(patch);
        const before = ["const a = 1;", "console.log(a);"].join("\n");
        const after = applyHunksToContent(before, parsed[0].hunks);

        expect(after).toContain("const b = 2;");
        expect(after.split("\n")).toHaveLength(3);
    });
});

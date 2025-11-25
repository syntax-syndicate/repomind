import { repairMarkdown } from './src/lib/markdown-utils';

// Understanding Test 2's actual behavior
const test2Input = `
CHAPTER

\`\`\`markdown
# Nested
\`\`\`bash
echo "nested"
\`\`\`
\`\`\`
`;

console.log("=== Analyzing Test 2 ===");
console.log("\nWhat Test 2 Input MEANS per CommonMark:");
console.log("- Line 0: ```markdown (opener, length=3)");
console.log("- Line 2: ```bash (content - this is INSIDE the markdown block)");
console.log("- Line 4: ``` (closer for the markdown block, length=3 >= 3, no info)");
console.log("- Line 5: ``` (orphan fence with no opener)");

console.log("\nInput:");
console.log(test2Input.trim());

const result = repairMarkdown(test2Input.trim(), false);
console.log("\nOutput:");
console.log(result);

const expected = `\`\`\`\`markdown
# Nested
\`\`\`bash
echo "nested"
\`\`\`
\`\`\`\``;

console.log("\nTest 2 Expected:");
console.log(expected);

console.log("\nWhat Expected Output achieves:");
console.log("- Extends to 4 backticks so the ``` on line 4 becomes CONTENT");
console.log("- This PRESERVES the inner ```bash block structure");
console.log("- Without extension, the block closes prematurely at line 4");

console.log("\nDoes output match expected?", result.trim() === expected.trim());

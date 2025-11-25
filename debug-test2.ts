import { repairMarkdown } from './src/lib/markdown-utils';

// Test 2 from the test suite
const input2 = `
\`\`\`markdown
# Nested
\`\`\`bash
echo "nested"
\`\`\`
\`\`\`
`;

console.log("Input:");
console.log(input2.trim());
console.log();

const result = repairMarkdown(input2.trim(), true);  // Enable debug
console.log("\n\nFinal Output:");
console.log(result);

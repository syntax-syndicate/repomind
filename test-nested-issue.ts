import { repairMarkdown } from './src/lib/markdown-utils';

// This is the simplified issue:
// We have a 4-backtick outer fence containing content that includes a 3-backtick code block
const testCase1 = `\`\`\`\`jsx
function App() {
  return <div>Hello</div>;
}
\`\`\`

More text here
\`\`\`\``;

console.log("=== Test Case 1: Properly closed block ===");
console.log("Input:");
console.log(testCase1);
console.log("\nOutput:");
const result1 = repairMarkdown(testCase1);
console.log(result1);
console.log("\nUnchanged?", result1 === testCase1);

// This is the ACTUAL problem scenario from repro_issue.ts:
// The opening fence is ````jsx but somewhere in the content there's a ``` that's NOT matched
// The algorithm needs to detect this is CONTENT, not a closing fence for a nested block
const testCase2 = `\`\`\`\`jsx
import { createRoot } from 'react-dom/client';

function HelloMessage({ name }) {
  return <div>Hello {name}</div>;
}

const root = createRoot(document.getElementById('container'));
root.render(<HelloMessage name="Taylor" />);
\`\`\`

-   This snippet uses **JSX**, an HTML-like syntax.
\`\`\`\``;

console.log("\n\n=== Test Case 2: Content with 3-backtick separator ===");
console.log("Input:");
console.log(testCase2);
console.log("\nOutput:");
const result2 = repairMarkdown(testCase2);
console.log(result2);
console.log("\nUnchanged?", result2 === testCase2);

// Edge case: What if the ``` appears WITHOUT a proper closing ````?
// This simulates what happens when the AI streams incomplete markdown
const testCase3 = `\`\`\`\`jsx
import { createRoot } from 'react-dom/client';
\`\`\`

More content`;

console.log("\n\n=== Test Case 3: Incomplete/broken block ===");
console.log("Input:");
console.log(testCase3);
console.log("\nOutput:");
const result3 = repairMarkdown(testCase3);
console.log(result3);
console.log("\nChanged?", result3 !== testCase3);

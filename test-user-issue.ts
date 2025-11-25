import { repairMarkdown } from './src/lib/markdown-utils';

// The ACTUAL user-reported issue:
// A properly closed 4-backtick block should NOT be modified
const userIssue = `\`\`\`\`jsx
import { createRoot } from 'react-dom/client';

function HelloMessage({ name }) {
  return <div>Hello {name}</div>;
}

const root = createRoot(document.getElementById('container'));
root.render(<HelloMessage name="Taylor" />);
\`\`\`

-   This snippet uses **JSX**, an HTML-like syntax.
\`\`\`\``;

console.log("=== User-Reported Issue Test ===");
console.log("Input (already properly closed with 4 backticks):");
console.log(userIssue);
console.log("\n\nOutput:");
const result = repairMarkdown(userIssue);
console.log(result);
console.log("\n\nUnchanged?", result === userIssue);
console.log("✅ Test", result === userIssue ? "PASSED" : "FAILED");

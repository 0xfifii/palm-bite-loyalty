// Fails if any project file contains an emoji, an em dash or an en dash.
// Usage: npm run check:copy
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const skip = new Set(["node_modules", ".next", ".git", "e2e-output", "fonts"]);
const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".sql", ".md", ".json", ".py", ".sh", ".svg", ".example", ".toml", ".webmanifest"]);
const banned = [
  { name: "em dash", re: new RegExp(String.fromCharCode(0x2014)) },
  { name: "en dash", re: new RegExp(String.fromCharCode(0x2013)) },
  { name: "emoji", re: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u },
];

const problems = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name)) || entry.name.startsWith(".env")) {
      const lines = fs.readFileSync(full, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const b of banned) if (b.re.test(line)) problems.push(`${path.relative(root, full)}:${i + 1} contains ${b.name}`);
      });
    }
  }
}
walk(root);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Copy check passed: no emoji, em dashes or en dashes.");

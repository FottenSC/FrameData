import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

const repoRoot = path.resolve(
  path.dirname(
    new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  ),
  "..",
);
const distDir = path.join(repoRoot, "dist");
const indexPath = path.join(distDir, "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf8");

const initialAssetPaths = new Set();
for (const match of indexHtml.matchAll(
  /(?:src|href)="\/(assets\/[^"]+\.js)"/g,
)) {
  initialAssetPaths.add(match[1]);
}

const forbiddenInitialChunks =
  /CommandPalette|FrameDataTable|moveData\.worker|vendor-(?:cmdk|sonner)/i;
const forbidden = [...initialAssetPaths].filter((asset) =>
  forbiddenInitialChunks.test(asset),
);

let initialGzipBytes = 0;
for (const relativePath of initialAssetPaths) {
  const source = fs.readFileSync(path.join(distDir, relativePath));
  initialGzipBytes += gzipSync(source, { level: 9 }).length;
}

const sourceMaps = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (entry.name.endsWith(".map")) sourceMaps.push(fullPath);
  }
};
visit(distDir);

const failures = [];
const initialBudgetBytes = 160 * 1024;
if (initialGzipBytes > initialBudgetBytes) {
  failures.push(
    `initial JavaScript is ${(initialGzipBytes / 1024).toFixed(2)} KiB gzip; budget is 160 KiB`,
  );
}
if (forbidden.length > 0) {
  failures.push(
    `lazy-only chunks were preloaded by index.html: ${forbidden.join(", ")}`,
  );
}
if (sourceMaps.length > 0) {
  failures.push(
    `production output contains ${sourceMaps.length} source map(s)`,
  );
}

if (failures.length > 0) {
  console.error("Performance budget failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Performance budget passed: ${(initialGzipBytes / 1024).toFixed(2)} KiB gzip across ${initialAssetPaths.size} initial JavaScript files.`,
);

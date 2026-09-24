import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");
const scanDirs = ["app", "components"];
const failures = [];
const checked = [];

function toPortable(filePath) {
  return filePath.split(path.sep).join("/");
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next"].includes(entry.name)) continue;
      files.push(...walkFiles(fullPath));
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function routePathFromPage(pageFile) {
  const relative = toPortable(path.relative(appDir, pageFile));
  if (/^page\.(tsx|ts|jsx|js)$/.test(relative)) return "/";
  const route = relative.replace(/\/page\.(tsx|ts|jsx|js)$/, "");
  return route === "" ? "/" : `/${route}`;
}

function routeToRegex(route) {
  if (route === "/") return /^\/$/;
  const escaped = route
    .split("/")
    .map((part) => {
      if (!part) return "";
      if (/^\[\[\.\.\..+\]\]$/.test(part)) return "(?:/.+)?";
      if (/^\[\.\.\..+\]$/.test(part)) return ".+";
      if (/^\[.+\]$/.test(part)) return "[^/]+";
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped}$`);
}

const routePatterns = walkFiles(appDir)
  .filter((file) => /\/page\.(tsx|ts|jsx|js)$/.test(toPortable(file)))
  .map(routePathFromPage)
  .map((route) => ({ route, regex: routeToRegex(route) }));

function normalizeHref(href) {
  const trimmed = href.trim();
  if (trimmed.includes("${")) return null;
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/api/")) return null;
  const withoutHash = trimmed.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  return withoutQuery || "/";
}

function isRouteKnown(hrefPath) {
  return routePatterns.some(({ regex }) => regex.test(hrefPath));
}

function scanFile(file) {
  const relative = toPortable(path.relative(root, file));
  const text = fs.readFileSync(file, "utf8");
  const hrefPatterns = [
    /\bhref\s*=\s*["'`]([^"'`]+)["'`]/g,
    /\bhref\s*=\s*\{\s*["'`]([^"'`]+)["'`]\s*\}/g,
  ];

  for (const pattern of hrefPatterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const original = match[1];
      const hrefPath = normalizeHref(original);
      if (!hrefPath) continue;
      checked.push({ file: relative, href: original, path: hrefPath });
      if (!isRouteKnown(hrefPath)) {
        failures.push(`${relative}: internal href "${original}" does not match an app page route`);
      }
    }
  }
}

for (const dir of scanDirs) {
  for (const file of walkFiles(path.join(root, dir))) scanFile(file);
}

if (failures.length > 0) {
  console.error("Internal route check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Internal route check passed. Checked ${checked.length} literal internal hrefs against ${routePatterns.length} page routes.`);

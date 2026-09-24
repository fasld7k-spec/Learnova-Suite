import fs from 'node:fs';
import path from 'node:path';

const adminDir = path.join(process.cwd(), 'app', 'admin');
const apiAdminDir = path.join(process.cwd(), 'app', 'api', 'admin');

function walk(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, files);
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function routeFileForEndpoint(endpoint) {
  return path.join(process.cwd(), 'app', endpoint.replace(/^\//, ''), 'route.ts');
}

function extractForms(source) {
  return Array.from(source.matchAll(/<form[\s\S]*?action=["']([^"']+)["'][\s\S]*?<\/form>/g)).map((match) => ({
    endpoint: match[1],
    body: match[0],
  }));
}

function extractLiteralActions(formBody) {
  const actions = [];
  const inputPattern = /name=["'](_?action)["'][\s\S]{0,160}?value=["']([^"']+)["']/g;
  for (const match of formBody.matchAll(inputPattern)) actions.push({ field: match[1], value: match[2] });
  return actions;
}

const pageFiles = walk(adminDir, (file) => path.basename(file) === 'page.tsx');
const apiRouteFiles = walk(apiAdminDir, (file) => path.basename(file) === 'route.ts');
const findings = [];

for (const file of pageFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relativeFile = toPosix(path.relative(process.cwd(), file));

  for (const form of extractForms(source)) {
    if (!form.endpoint.startsWith('/api/admin/')) continue;

    const routeFile = routeFileForEndpoint(form.endpoint);
    if (!fs.existsSync(routeFile)) {
      findings.push(`${relativeFile}: form posts to missing endpoint ${form.endpoint}`);
      continue;
    }

    const routeSource = fs.readFileSync(routeFile, 'utf8');
    for (const action of extractLiteralActions(form.body)) {
      if (!routeSource.includes(action.value)) {
        findings.push(`${relativeFile}: form action ${action.field}=${action.value} is not referenced by ${toPosix(path.relative(process.cwd(), routeFile))}`);
      }
    }
  }
}

for (const routeFile of apiRouteFiles) {
  const source = fs.readFileSync(routeFile, 'utf8');
  const relativeFile = toPosix(path.relative(process.cwd(), routeFile));
  if (/not implemented|coming soon|demo only|stub/i.test(source)) {
    findings.push(`${relativeFile}: contains incomplete implementation marker`);
  }
}

if (findings.length) {
  console.error('Admin panel integrity check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Admin panel integrity check passed. Checked ${pageFiles.length} admin pages and ${apiRouteFiles.length} admin API routes.`);

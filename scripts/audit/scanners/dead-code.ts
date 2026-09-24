/**
 * Dead Code Scanner
 *
 * Detects dead exports in `lib/`, stale Python scripts and log files at the
 * project root, and duplicate routes in `app/`.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { GapItem, Scanner, ScannerContext } from '../types';

/**
 * Next.js convention exports that should never be flagged as dead.
 * These are consumed by the Next.js framework at build time.
 */
export const NEXTJS_CONVENTIONS: string[] = [
  'default',
  'metadata',
  'generateMetadata',
  'generateStaticParams',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

/**
 * Determines if an export is dead (unused).
 * Returns true if the export has zero imports AND is not a Next.js convention.
 *
 * Exported for property testing (Property 11).
 */
export function isDeadExport(
  exportName: string,
  importReferences: string[],
  nextJsConventions: string[] = NEXTJS_CONVENTIONS
): boolean {
  // If it's a Next.js convention export, it's never dead
  if (nextJsConventions.includes(exportName)) {
    return false;
  }
  // If there are zero import references, it's dead
  return importReferences.length === 0;
}

/**
 * Extracts named exports from a TypeScript/JavaScript file content.
 * Handles: export function, export const, export class, export type,
 * export interface, export enum, export default, and export { ... }.
 */
export function extractExports(fileContent: string): string[] {
  const exports: string[] = [];

  // Match: export function name, export async function name
  const funcRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(fileContent)) !== null) {
    exports.push(match[1]);
  }

  // Match: export const name, export let name, export var name
  const varRegex = /export\s+(?:const|let|var)\s+(\w+)/g;
  while ((match = varRegex.exec(fileContent)) !== null) {
    exports.push(match[1]);
  }

  // Match: export class name
  const classRegex = /export\s+class\s+(\w+)/g;
  while ((match = classRegex.exec(fileContent)) !== null) {
    exports.push(match[1]);
  }

  // Match: export type name, export interface name
  const typeRegex = /export\s+(?:type|interface)\s+(\w+)/g;
  while ((match = typeRegex.exec(fileContent)) !== null) {
    exports.push(match[1]);
  }

  // Match: export enum name
  const enumRegex = /export\s+enum\s+(\w+)/g;
  while ((match = enumRegex.exec(fileContent)) !== null) {
    exports.push(match[1]);
  }

  // Match: export default
  const defaultRegex = /export\s+default\s/g;
  if (defaultRegex.test(fileContent)) {
    exports.push('default');
  }

  // Match: export { name1, name2, ... }
  const reExportRegex = /export\s*\{([^}]+)\}/g;
  while ((match = reExportRegex.exec(fileContent)) !== null) {
    const names = match[1].split(',').map(n => {
      // Handle "name as alias" — use the original name
      const parts = n.trim().split(/\s+as\s+/);
      return parts[0].trim();
    });
    for (const name of names) {
      if (name && name !== '') {
        exports.push(name);
      }
    }
  }

  return Array.from(new Set(exports));
}

/**
 * Extracts import references from a file content.
 * Returns an array of imported symbol names.
 */
export function extractImports(fileContent: string): string[] {
  const imports: string[] = [];

  // Match: import { name1, name2 } from '...'
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s/g;
  let match: RegExpExecArray | null;
  while ((match = namedImportRegex.exec(fileContent)) !== null) {
    const names = match[1].split(',').map(n => {
      // Handle "name as alias" — use the original name
      const parts = n.trim().split(/\s+as\s+/);
      return parts[0].trim();
    });
    for (const name of names) {
      if (name && name !== '') {
        imports.push(name);
      }
    }
  }

  // Match: import name from '...' (default import)
  const defaultImportRegex = /import\s+(\w+)\s+from\s/g;
  while ((match = defaultImportRegex.exec(fileContent)) !== null) {
    // The local name doesn't tell us the export name, but it implies 'default' is used
    imports.push('default');
  }

  // Match: import * as name from '...' (namespace import — imports all)
  const namespaceImportRegex = /import\s+\*\s+as\s+\w+\s+from\s/g;
  while ((match = namespaceImportRegex.exec(fileContent)) !== null) {
    imports.push('*');
  }

  return imports;
}

/**
 * Resolves a Next.js app directory path to its URL route.
 * Strips route groups (parenthesized segments), handles dynamic segments,
 * and normalizes to a URL path.
 */
export function resolveRouteUrl(routePath: string): string {
  const segments = routePath.split('/');
  const urlSegments: string[] = [];

  for (const segment of segments) {
    // Skip the 'app' root
    if (segment === 'app') continue;
    // Skip route files (page.tsx, route.ts, etc.)
    if (/^(page|route|layout|loading|error|not-found|template)\.(ts|tsx|js|jsx)$/.test(segment)) continue;
    // Skip route groups (parenthesized)
    if (segment.startsWith('(') && segment.endsWith(')')) continue;
    // Keep dynamic segments as-is for comparison
    urlSegments.push(segment);
  }

  const url = '/' + urlSegments.join('/');
  return url === '/' ? '/' : url.replace(/\/$/, '');
}

/**
 * Scans for dead exports in lib/ files.
 */
async function scanDeadExports(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  // Get all TypeScript files in lib/
  const libFiles = await ctx.glob('lib/**/*.ts');
  if (libFiles.length === 0) return gaps;

  // Get all TypeScript/TSX files in the codebase that could import from lib/
  const allTsFiles = [
    ...(await ctx.glob('app/**/*.ts')),
    ...(await ctx.glob('app/**/*.tsx')),
    ...(await ctx.glob('lib/**/*.ts')),
    ...(await ctx.glob('components/**/*.ts')),
    ...(await ctx.glob('components/**/*.tsx')),
    ...(await ctx.glob('scripts/**/*.ts')),
    ...(await ctx.glob('tests/**/*.ts')),
  ];

  // Build a map of all imports across the codebase
  const allImportedSymbols = new Map<string, string[]>(); // symbol -> files that import it

  for (const file of allTsFiles) {
    try {
      const content = await ctx.readFile(file);
      const importedNames = extractImports(content);
      for (const name of importedNames) {
        if (!allImportedSymbols.has(name)) {
          allImportedSymbols.set(name, []);
        }
        allImportedSymbols.get(name)!.push(file);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Check each lib/ file's exports against the import map
  for (const libFile of libFiles) {
    try {
      const content = await ctx.readFile(libFile);
      const exports = extractExports(content);

      for (const exportName of exports) {
        const importRefs = allImportedSymbols.get(exportName) ?? [];
        // Filter out self-imports (same file importing its own export)
        const externalRefs = importRefs.filter(f => f !== libFile);

        if (isDeadExport(exportName, externalRefs, NEXTJS_CONVENTIONS)) {
          gaps.push({
            id: '',
            area: 'dead-export',
            severity: 'minor',
            description: `Export "${exportName}" in "${libFile}" is not imported anywhere in the codebase`,
            evidence_paths: [libFile],
            requirement_refs: ['project-completion-audit/6.1'],
            proposed_action: `Remove the unused export "${exportName}" or add it to a public API barrel file if it's intended for external use`,
          });
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return gaps;
}

/**
 * Scans for stale Python scripts at the project root.
 */
async function scanStalePythonScripts(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  try {
    const rootEntries = await ctx.listDir('.', 1);
    const pyFiles = rootEntries.filter(entry => entry.endsWith('.py'));

    for (const pyFile of pyFiles) {
      gaps.push({
        id: '',
        area: 'stale-script',
        severity: 'minor',
        description: `Stale Python script "${pyFile}" found at project root`,
        evidence_paths: [pyFile],
        requirement_refs: ['project-completion-audit/6.2'],
        proposed_action: `Document "${pyFile}" in scripts/README.md or move it into scripts/archive/`,
      });
    }
  } catch {
    // Root directory listing failed — skip gracefully
  }

  return gaps;
}

/**
 * Scans for stale log files at the project root.
 */
async function scanStaleLogFiles(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  try {
    const rootEntries = await ctx.listDir('.', 1);
    const logFiles = rootEntries.filter(
      entry => entry.endsWith('.log') || entry.endsWith('.err.log')
    );

    for (const logFile of logFiles) {
      gaps.push({
        id: '',
        area: 'stale-log',
        severity: 'minor',
        description: `Stale log file "${logFile}" found at project root`,
        evidence_paths: [logFile],
        requirement_refs: ['project-completion-audit/6.3'],
        proposed_action: `Ensure "*.log" and "*.err.log" patterns are in .gitignore and remove tracked log files`,
      });
    }
  } catch {
    // Root directory listing failed — skip gracefully
  }

  return gaps;
}

/**
 * Scans for duplicate routes in app/ that resolve to the same URL.
 */
async function scanDuplicateRoutes(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  // Find all route files (page.tsx, route.ts)
  const routeFiles = [
    ...(await ctx.glob('app/**/page.tsx')),
    ...(await ctx.glob('app/**/page.ts')),
    ...(await ctx.glob('app/**/route.tsx')),
    ...(await ctx.glob('app/**/route.ts')),
  ];

  // Map each route file to its resolved URL
  const urlToFiles = new Map<string, string[]>();

  for (const routeFile of routeFiles) {
    const url = resolveRouteUrl(routeFile);
    if (!urlToFiles.has(url)) {
      urlToFiles.set(url, []);
    }
    urlToFiles.get(url)!.push(routeFile);
  }

  // Emit gaps for URLs with multiple route files
  for (const [url, files] of Array.from(urlToFiles.entries())) {
    if (files.length > 1) {
      gaps.push({
        id: '',
        area: 'duplicate-route',
        severity: 'minor',
        description: `Multiple routes resolve to the same URL "${url}": ${files.join(', ')}`,
        evidence_paths: files.sort(),
        requirement_refs: ['project-completion-audit/6.4'],
        proposed_action: `Remove or rename one of the duplicate routes resolving to "${url}"`,
      });
    }
  }

  return gaps;
}

/**
 * Dead Code Scanner implementation.
 *
 * Detects:
 * - Dead exports in lib/ (exported symbols not imported anywhere)
 * - Stale Python scripts at project root
 * - Stale log files at project root
 * - Duplicate routes in app/ resolving to the same URL
 */
export const deadCodeScanner: Scanner = {
  name: 'dead-code',

  async scan(ctx: ScannerContext): Promise<GapItem[]> {
    const gaps: GapItem[] = [];

    // Scan for dead exports in lib/
    gaps.push(...(await scanDeadExports(ctx)));

    // Scan for stale Python scripts at project root
    gaps.push(...(await scanStalePythonScripts(ctx)));

    // Scan for stale log files at project root
    gaps.push(...(await scanStaleLogFiles(ctx)));

    // Scan for duplicate routes in app/
    gaps.push(...(await scanDuplicateRoutes(ctx)));

    return gaps;
  },
};

export default deadCodeScanner;

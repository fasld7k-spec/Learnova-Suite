/**
 * Partial Implementation Scanner
 *
 * Detects incomplete or stub implementations across the codebase:
 * - Stub routes in `app/api/` (returning 501 or throwing "Not implemented")
 * - Unused Prisma models not referenced in `lib/` or `app/`
 * - Incomplete payment adapters in `lib/payment-gateways/` missing required methods
 * - Placeholder pages in `app/admin/` containing placeholder text
 * - Incomplete theme components in `components/themes/` (< 50 non-comment lines or missing markers)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { GapItem, Scanner, ScannerContext } from '../types';

// --- Detection Functions (exported for property testing) ---

/**
 * Returns true if the content contains a stub route indicator:
 * - `NextResponse.json({}, { status: 501 })`
 * - `throw new Error("Not implemented")`
 *
 * Requirement 3.1
 */
export function isStubRoute(content: string): boolean {
  return (
    content.includes('NextResponse.json({}, { status: 501 })') ||
    content.includes('throw new Error("Not implemented")')
  );
}

/**
 * Returns true if the content contains placeholder text (case-insensitive):
 * - "Coming soon"
 * - "قيد الإنشاء"
 * - "TBD"
 *
 * Requirement 3.4
 */
export function isPlaceholderPage(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('coming soon') ||
    content.includes('قيد الإنشاء') ||
    lower.includes('tbd')
  );
}

/**
 * Returns true if the content represents an incomplete theme component:
 * - Less than 50 non-comment lines, OR
 * - Missing all of the markers: `data-theme=`, `themeStyle(`, `--home-`
 *
 * Requirement 3.5
 */
export function isIncompleteThemeComponent(content: string): boolean {
  const nonCommentLineCount = countNonCommentLines(content);
  if (nonCommentLineCount < 50) return true;

  const hasDataTheme = content.includes('data-theme=');
  const hasThemeStyle = content.includes('themeStyle(');
  const hasHomeCssVar = content.includes('--home-');

  // Missing markers means none of the three are present
  if (!hasDataTheme && !hasThemeStyle && !hasHomeCssVar) return true;

  return false;
}

/**
 * Counts non-comment lines in a file content string.
 * Excludes:
 * - Empty/whitespace-only lines
 * - Single-line comments (// ...)
 * - Multi-line comment blocks (/* ... *​/)
 */
function countNonCommentLines(content: string): number {
  const lines = content.split('\n');
  let count = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) {
        inBlockComment = true;
      }
      continue;
    }

    if (trimmed === '' || trimmed.startsWith('//')) {
      continue;
    }

    count++;
  }

  return count;
}

function prismaDelegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

// --- Required payment adapter methods ---

const REQUIRED_PAYMENT_METHODS = [
  'createSession',
  'verifyWebhook',
  'capturePayment',
  'refundPayment',
] as const;

// --- Scanner Implementation ---

/**
 * Scans for stub routes in app/api/ that return 501 or throw "Not implemented".
 */
async function scanStubRoutes(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  const routeFiles = await ctx.glob('app/api/**/route.ts');
  const routeFilesTsx = await ctx.glob('app/api/**/route.tsx');
  const allRouteFiles = [...routeFiles, ...routeFilesTsx];

  for (const filePath of allRouteFiles) {
    try {
      const content = await ctx.readFile(filePath);
      if (isStubRoute(content)) {
        gaps.push({
          id: '',
          area: 'empty-route',
          severity: 'major',
          description: `Stub route handler detected: returns 501 or throws "Not implemented"`,
          evidence_paths: [filePath],
          requirement_refs: ['project-completion-audit/3.1'],
          proposed_action: `Implement the route handler in "${filePath}" with actual business logic`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }

  return gaps;
}

/**
 * Extracts model names from prisma/schema.prisma and checks if they are
 * referenced in any .ts/.tsx file under lib/ or app/.
 */
async function scanUnusedPrismaModels(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  // Read the Prisma schema
  const schemaPath = 'prisma/schema.prisma';
  if (!(await ctx.fileExists(schemaPath))) {
    return gaps;
  }

  const schemaContent = await ctx.readFile(schemaPath);

  // Extract model names using regex: `model ModelName {`
  const modelRegex = /^model\s+(\w+)\s*\{/gm;
  const modelNames: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    modelNames.push(match[1]);
  }

  if (modelNames.length === 0) return gaps;

  // Gather all .ts and .tsx files under lib/ and app/
  const libFiles = await ctx.glob('lib/**/*.ts');
  const libFilesTsx = await ctx.glob('lib/**/*.tsx');
  const appFiles = await ctx.glob('app/**/*.ts');
  const appFilesTsx = await ctx.glob('app/**/*.tsx');
  const allFiles = [...libFiles, ...libFilesTsx, ...appFiles, ...appFilesTsx];

  // Read all file contents and concatenate for searching
  const allContents: string[] = [];
  for (const filePath of allFiles) {
    try {
      const content = await ctx.readFile(filePath);
      allContents.push(content);
    } catch {
      // Skip unreadable files
    }
  }
  const combinedContent = allContents.join('\n');

  // Check each model name for references. Prisma Client uses lower-camel
  // delegate names such as `prisma.courseNote`, so count those as real usage
  // instead of reporting false positives for implemented features.
  for (const modelName of modelNames) {
    const delegateName = prismaDelegateName(modelName);
    if (!combinedContent.includes(modelName) && !combinedContent.includes(`.${delegateName}`)) {
      gaps.push({
        id: '',
        area: 'unused-model',
        severity: 'minor',
        description: `Prisma model "${modelName}" is not referenced in any file under lib/ or app/`,
        evidence_paths: [schemaPath],
        requirement_refs: ['project-completion-audit/3.2'],
        proposed_action: `Either implement usage of model "${modelName}" or remove it from the schema if no longer needed`,
      });
    }
  }

  return gaps;
}

/**
 * Scans payment gateway adapters in lib/payment-gateways/ for missing required methods.
 */
async function scanIncompletePaymentAdapters(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  const gatewayDir = 'lib/payment-gateways';
  if (!(await ctx.fileExists(gatewayDir))) {
    return gaps;
  }

  const entries = await ctx.listDir(gatewayDir, 1);
  const adapterFiles = entries.filter(
    entry => entry.endsWith('.ts') && entry !== 'base.ts'
  );

  for (const fileName of adapterFiles) {
    const filePath = `${gatewayDir}/${fileName}`;
    try {
      const content = await ctx.readFile(filePath);
      const missingMethods: string[] = [];

      for (const method of REQUIRED_PAYMENT_METHODS) {
        // Check if the method is defined (as a function, method, or property)
        if (!content.includes(method)) {
          missingMethods.push(method);
        }
      }

      if (missingMethods.length > 0) {
        gaps.push({
          id: '',
          area: 'incomplete-adapter',
          severity: 'blocker',
          description: `Payment adapter "${fileName}" is missing required methods: ${missingMethods.join(', ')}`,
          evidence_paths: [filePath],
          requirement_refs: ['project-completion-audit/3.3'],
          proposed_action: `Implement the missing methods (${missingMethods.join(', ')}) in "${filePath}" following the GatewayAdapter interface`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }

  return gaps;
}

/**
 * Scans admin pages in app/admin/ for placeholder content.
 */
async function scanPlaceholderPages(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  const pageFiles = await ctx.glob('app/admin/**/page.tsx');
  const pageFilesTsx = await ctx.glob('app/admin/**/page.ts');
  const allPageFiles = [...pageFiles, ...pageFilesTsx];

  for (const filePath of allPageFiles) {
    try {
      const content = await ctx.readFile(filePath);
      if (isPlaceholderPage(content)) {
        gaps.push({
          id: '',
          area: 'placeholder-page',
          severity: 'minor',
          description: `Placeholder page detected containing "Coming soon", "قيد الإنشاء", or "TBD"`,
          evidence_paths: [filePath],
          requirement_refs: ['project-completion-audit/3.4'],
          proposed_action: `Replace placeholder content in "${filePath}" with actual admin page implementation`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }

  return gaps;
}

/**
 * Scans theme components in components/themes/ for incomplete implementations.
 */
async function scanIncompleteThemeComponents(ctx: ScannerContext): Promise<GapItem[]> {
  const gaps: GapItem[] = [];

  const themeDir = 'components/themes';
  if (!(await ctx.fileExists(themeDir))) {
    return gaps;
  }

  const themeFiles = await ctx.glob('components/themes/**/*.tsx');
  const themeFilesTs = await ctx.glob('components/themes/**/*.ts');
  const allThemeFiles = [...themeFiles, ...themeFilesTs];

  for (const filePath of allThemeFiles) {
    try {
      const content = await ctx.readFile(filePath);
      if (isIncompleteThemeComponent(content)) {
        const nonCommentLines = countNonCommentLines(content);
        const hasDataTheme = content.includes('data-theme=');
        const hasThemeStyle = content.includes('themeStyle(');
        const hasHomeCssVar = content.includes('--home-');

        const reasons: string[] = [];
        if (nonCommentLines < 50) {
          reasons.push(`only ${nonCommentLines} non-comment lines (minimum 50)`);
        }
        if (!hasDataTheme && !hasThemeStyle && !hasHomeCssVar) {
          reasons.push('missing theme markers (data-theme=, themeStyle(, or --home-)');
        }

        gaps.push({
          id: '',
          area: 'incomplete-theme-component',
          severity: 'major',
          description: `Incomplete theme component: ${reasons.join('; ')}`,
          evidence_paths: [filePath],
          requirement_refs: ['project-completion-audit/3.5'],
          proposed_action: `Complete the theme component in "${filePath}" — ensure at least 50 non-comment lines and include theme markers`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }

  return gaps;
}

// --- Main Scanner Export ---

/**
 * Partial Implementation Scanner.
 *
 * Detects stub routes, unused Prisma models, incomplete payment adapters,
 * placeholder admin pages, and incomplete theme components.
 */
export const partialImplScanner: Scanner = {
  name: 'partial-impl',

  async scan(ctx: ScannerContext): Promise<GapItem[]> {
    const gaps: GapItem[] = [];

    gaps.push(...await scanStubRoutes(ctx));
    gaps.push(...await scanUnusedPrismaModels(ctx));
    gaps.push(...await scanIncompletePaymentAdapters(ctx));
    gaps.push(...await scanPlaceholderPages(ctx));
    gaps.push(...await scanIncompleteThemeComponents(ctx));

    return gaps;
  },
};

export default partialImplScanner;

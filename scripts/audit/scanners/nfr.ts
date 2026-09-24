/**
 * Non-Functional Requirements (NFR) Scanner
 *
 * Verifies security, accessibility, and performance requirements:
 * - Mutating API routes import CSRF/auth helpers
 * - Webhook routes read raw body before parsing
 * - Home theme contrast ratios meet WCAG AA
 * - Required database indexes exist in prisma/schema.prisma
 * - Security headers in next.config.mjs and session cookie settings in lib/auth.ts
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import type { GapItem, Scanner, ScannerContext } from '../types';

// ---------------------------------------------------------------------------
// WCAG 2.1 Contrast Ratio Utilities (exported for property testing)
// ---------------------------------------------------------------------------

/**
 * Converts a hex color string to an [R, G, B] array of sRGB values in [0, 1].
 * Supports 3-digit (#RGB) and 6-digit (#RRGGBB) hex formats.
 */
export function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.replace(/^#/, '');
  if (cleaned.length === 3) {
    cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
  }
  const num = parseInt(cleaned, 16);
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  return [r, g, b];
}

/**
 * Converts an sRGB channel value to linear RGB per WCAG 2.1.
 * If value <= 0.03928, linear = value / 12.92
 * Else linear = ((value + 0.055) / 1.055) ^ 2.4
 */
export function srgbToLinear(value: number): number {
  if (value <= 0.03928) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

/**
 * Computes relative luminance per WCAG 2.1 formula.
 * L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const rLin = srgbToLinear(r);
  const gLin = srgbToLinear(g);
  const bLin = srgbToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Computes WCAG 2.1 contrast ratio between two hex colors.
 * Contrast ratio = (L1 + 0.05) / (L2 + 0.05) where L1 >= L2
 */
export function computeContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns true if the contrast between foreground and background meets WCAG AA.
 * Normal text: >= 4.5:1
 * Large text (or UI components/muted): >= 3:1
 */
export function meetsWcagAA(foreground: string, background: string, isLargeText: boolean): boolean {
  const ratio = computeContrastRatio(foreground, background);
  const threshold = isLargeText ? 3 : 4.5;
  return ratio >= threshold;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Auth/CSRF helper import patterns */
const AUTH_IMPORT_PATTERNS = [
  /from\s+['"]@?\/lib\/csrf['"]/,
  /from\s+['"]@?\/lib\/auth['"]/,
  /from\s+['"]@?\/lib\/request-security['"]/,
  /from\s+['"]\.\..*\/lib\/csrf['"]/,
  /from\s+['"]\.\..*\/lib\/auth['"]/,
  /from\s+['"]\.\..*\/lib\/request-security['"]/,
];

/** Patterns indicating a route handles mutating HTTP methods */
const MUTATING_HANDLER_PATTERNS = [
  /export\s+(async\s+)?function\s+POST/,
  /export\s+(async\s+)?function\s+PUT/,
  /export\s+(async\s+)?function\s+PATCH/,
  /export\s+(async\s+)?function\s+DELETE/,
  /export\s+const\s+POST/,
  /export\s+const\s+PUT/,
  /export\s+const\s+PATCH/,
  /export\s+const\s+DELETE/,
];

/** Required database indexes per learnova-platform-development-plan Requirement 10.4 */
const REQUIRED_INDEXES = [
  { model: 'Course', fields: ['status', 'categoryId'] },
  { model: 'Enrollment', fields: ['userId', 'completedAt'] },
  { model: 'Order', fields: ['userId', 'createdAt'] },
  { model: 'Notification', fields: ['userId', 'read', 'createdAt'] },
];

/**
 * Checks if a route file imports any CSRF or auth helper.
 */
function hasAuthOrCsrfImport(content: string): boolean {
  return AUTH_IMPORT_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Checks if a route file exports any mutating HTTP method handler.
 */
function hasMutatingHandler(content: string): boolean {
  return MUTATING_HANDLER_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Checks if a webhook route reads raw body before calling request.json().
 * Returns true if the file reads raw body first (correct behavior).
 * Returns false if request.json() appears before any raw body read.
 */
function readsRawBodyBeforeParsing(content: string): boolean {
  // Look for raw body reading patterns
  const rawBodyPatterns = [
    /req\.text\(\)/,
    /request\.text\(\)/,
    /req\.arrayBuffer\(\)/,
    /request\.arrayBuffer\(\)/,
    /rawBody/,
  ];

  const jsonParsePatterns = [
    /req\.json\(\)/,
    /request\.json\(\)/,
  ];

  const hasRawBodyRead = rawBodyPatterns.some(p => p.test(content));
  const hasJsonParse = jsonParsePatterns.some(p => p.test(content));

  // If no json() call, it's fine
  if (!hasJsonParse) return true;

  // If there's a json() call but no raw body read, that's a problem
  if (!hasRawBodyRead) return false;

  // If both exist, check that raw body read comes first
  const rawBodyIndex = Math.min(
    ...rawBodyPatterns
      .map(p => {
        const match = content.match(p);
        return match ? content.indexOf(match[0]) : Infinity;
      })
      .filter(i => i !== Infinity)
  );

  const jsonIndex = Math.min(
    ...jsonParsePatterns
      .map(p => {
        const match = content.match(p);
        return match ? content.indexOf(match[0]) : Infinity;
      })
      .filter(i => i !== Infinity)
  );

  return rawBodyIndex < jsonIndex;
}

/**
 * Parses the prisma schema to check for required indexes.
 * Returns a list of missing indexes.
 */
function findMissingIndexes(schemaContent: string): Array<{ model: string; fields: string[] }> {
  const missing: Array<{ model: string; fields: string[] }> = [];

  for (const required of REQUIRED_INDEXES) {
    // Find the model block
    const modelRegex = new RegExp(
      `model\\s+${required.model}\\s*\\{([^}]*(?:\\{[^}]*\\}[^}]*)*)\\}`,
      's'
    );
    const modelMatch = schemaContent.match(modelRegex);

    if (!modelMatch) {
      // Model doesn't exist — that's a different scanner's concern
      continue;
    }

    const modelBody = modelMatch[1];

    // Check if the required index exists
    // Index format: @@index([field1, field2, ...])
    const fieldsPattern = required.fields.map(f => `\\s*${f}\\s*`).join(',');
    const indexRegex = new RegExp(`@@index\\(\\[${fieldsPattern}\\]\\)`);

    if (!indexRegex.test(modelBody)) {
      missing.push(required);
    }
  }

  return missing;
}

/**
 * Checks if next.config.mjs has security headers configured.
 */
function hasSecurityHeaders(content: string): { hasHsts: boolean; hasNoSniff: boolean } {
  const hasHsts = /Strict-Transport-Security/i.test(content);
  const hasNoSniff = /X-Content-Type-Options/i.test(content) && /nosniff/i.test(content);
  return { hasHsts, hasNoSniff };
}

/**
 * Checks if lib/auth.ts sets session cookies with httpOnly and secure flags.
 */
function hasSecureCookieSettings(content: string): { hasHttpOnly: boolean; hasSecure: boolean } {
  const hasHttpOnly = /httpOnly\s*:\s*true/i.test(content);
  const hasSecure = /secure\s*:\s*true/i.test(content) || /secure\s*:\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/i.test(content);
  return { hasHttpOnly, hasSecure };
}

// ---------------------------------------------------------------------------
// Scanner Implementation
// ---------------------------------------------------------------------------

export const nfrScanner: Scanner = {
  name: 'nfr',

  async scan(ctx: ScannerContext): Promise<GapItem[]> {
    const gaps: GapItem[] = [];

    // --- Requirement 7.1: Verify mutating API routes import CSRF/auth helpers ---
    await scanMutatingRoutes(ctx, gaps);

    // --- Requirement 7.2: Verify webhook routes read raw body before parsing ---
    await scanWebhookRoutes(ctx, gaps);

    // --- Requirement 7.3: Verify home theme contrast ratios ---
    await scanThemeContrast(ctx, gaps);

    // --- Requirement 7.4: Verify required database indexes ---
    await scanDatabaseIndexes(ctx, gaps);

    // --- Requirement 7.5: Verify security headers and cookie settings ---
    await scanSecurityHeaders(ctx, gaps);

    return gaps;
  },
};

/**
 * Requirement 7.1: Verify that every mutating API route imports CSRF or auth helpers.
 */
async function scanMutatingRoutes(ctx: ScannerContext, gaps: GapItem[]): Promise<void> {
  const routeFiles = await ctx.glob('app/api/**/route.ts');
  const routeFilesTsx = await ctx.glob('app/api/**/route.tsx');
  const allRouteFiles = [...routeFiles, ...routeFilesTsx];

  // Exclude webhook routes (they have their own verification in 7.2)
  const nonWebhookRoutes = allRouteFiles.filter(f => !f.includes('webhooks'));

  for (const routePath of nonWebhookRoutes) {
    try {
      const content = await ctx.readFile(routePath);

      if (hasMutatingHandler(content) && !hasAuthOrCsrfImport(content)) {
        gaps.push({
          id: '',
          area: 'missing-csrf-or-auth',
          severity: 'blocker',
          description: `Mutating API route "${routePath}" does not import any CSRF or auth helper from lib/csrf.ts, lib/auth.ts, or lib/request-security.ts`,
          evidence_paths: [routePath],
          requirement_refs: ['project-completion-audit/7.1'],
          proposed_action: `Add an import of requireUser from lib/auth.ts or verifyCsrf from lib/csrf.ts to protect this mutating endpoint`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }
}

/**
 * Requirement 7.2: Verify that webhook routes read raw body before parsing.
 */
async function scanWebhookRoutes(ctx: ScannerContext, gaps: GapItem[]): Promise<void> {
  const webhookRoutes = await ctx.glob('app/api/webhooks/**/route.ts');
  const webhookRoutesTsx = await ctx.glob('app/api/webhooks/**/route.tsx');
  const allWebhookRoutes = [...webhookRoutes, ...webhookRoutesTsx];

  for (const routePath of allWebhookRoutes) {
    try {
      const content = await ctx.readFile(routePath);

      if (!readsRawBodyBeforeParsing(content)) {
        gaps.push({
          id: '',
          area: 'webhook-raw-body',
          severity: 'blocker',
          description: `Webhook route "${routePath}" calls request.json() before extracting the raw text body, which prevents signature verification`,
          evidence_paths: [routePath],
          requirement_refs: ['project-completion-audit/7.2'],
          proposed_action: `Refactor to read the raw body via request.text() before any JSON parsing to enable webhook signature verification`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }
}

/**
 * Requirement 7.3: Verify home theme contrast ratios meet WCAG AA.
 */
async function scanThemeContrast(ctx: ScannerContext, gaps: GapItem[]): Promise<void> {
  const registryPath = 'lib/home-theme-registry.ts';

  if (!(await ctx.fileExists(registryPath))) {
    return;
  }

  try {
    const content = await ctx.readFile(registryPath);

    // Extract theme definitions for theme-1 through theme-4
    const themeIds = ['theme-1', 'theme-2', 'theme-3', 'theme-4'];

    for (const themeId of themeIds) {
      // Extract color values from the theme defaults
      const colors = extractThemeColors(content, themeId);

      if (!colors) continue;

      const { textColor, mutedTextColor, backgroundColor } = colors;

      // Check text contrast (normal text >= 4.5:1)
      if (textColor && backgroundColor) {
        if (!isValidHex(textColor) || !isValidHex(backgroundColor)) continue;

        const textRatio = computeContrastRatio(textColor, backgroundColor);
        if (textRatio < 4.5) {
          gaps.push({
            id: '',
            area: 'accessibility-contrast',
            severity: 'major',
            description: `Home theme "${themeId}" text contrast ratio is ${textRatio.toFixed(2)}:1 (textColor: ${textColor} on backgroundColor: ${backgroundColor}), which is below the WCAG AA minimum of 4.5:1`,
            evidence_paths: [registryPath],
            requirement_refs: ['project-completion-audit/7.3'],
            proposed_action: `Adjust textColor or backgroundColor in "${themeId}" to achieve at least 4.5:1 contrast ratio`,
          });
        }
      }

      // Check muted text contrast (large/muted text >= 3:1)
      if (mutedTextColor && backgroundColor) {
        if (!isValidHex(mutedTextColor) || !isValidHex(backgroundColor)) continue;

        const mutedRatio = computeContrastRatio(mutedTextColor, backgroundColor);
        if (mutedRatio < 3) {
          gaps.push({
            id: '',
            area: 'accessibility-contrast',
            severity: 'major',
            description: `Home theme "${themeId}" muted text contrast ratio is ${mutedRatio.toFixed(2)}:1 (mutedTextColor: ${mutedTextColor} on backgroundColor: ${backgroundColor}), which is below the WCAG AA minimum of 3:1 for muted/large text`,
            evidence_paths: [registryPath],
            requirement_refs: ['project-completion-audit/7.3'],
            proposed_action: `Adjust mutedTextColor or backgroundColor in "${themeId}" to achieve at least 3:1 contrast ratio`,
          });
        }
      }
    }
  } catch {
    // File read error — skip gracefully
  }
}

/**
 * Extracts theme color values from the registry file content.
 */
function extractThemeColors(
  content: string,
  themeId: string
): { textColor: string; mutedTextColor: string; backgroundColor: string } | null {
  // Find the theme block by its id
  const themeStart = content.indexOf(`id: '${themeId}'`);
  if (themeStart === -1) return null;

  // Find the defaults section within this theme
  const defaultsStart = content.indexOf('defaults:', themeStart);
  if (defaultsStart === -1) return null;

  // Find the next theme or end of array
  const nextThemeStart = content.indexOf(`id: 'theme-`, defaultsStart + 10);
  const themeBlock = nextThemeStart === -1
    ? content.slice(defaultsStart)
    : content.slice(defaultsStart, nextThemeStart);

  const textColor = extractColorValue(themeBlock, 'textColor');
  const mutedTextColor = extractColorValue(themeBlock, 'mutedTextColor');
  const backgroundColor = extractColorValue(themeBlock, 'backgroundColor');

  if (!textColor || !mutedTextColor || !backgroundColor) return null;

  return { textColor, mutedTextColor, backgroundColor };
}

/**
 * Extracts a color value from a theme block.
 */
function extractColorValue(block: string, key: string): string | null {
  const regex = new RegExp(`${key}:\\s*['"]([^'"]+)['"]`);
  const match = block.match(regex);
  return match ? match[1] : null;
}

/**
 * Validates that a string is a valid hex color (#RGB or #RRGGBB).
 */
function isValidHex(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

/**
 * Requirement 7.4: Verify required database indexes exist in prisma/schema.prisma.
 */
async function scanDatabaseIndexes(ctx: ScannerContext, gaps: GapItem[]): Promise<void> {
  const schemaPath = 'prisma/schema.prisma';

  if (!(await ctx.fileExists(schemaPath))) {
    return;
  }

  try {
    const content = await ctx.readFile(schemaPath);
    const missingIndexes = findMissingIndexes(content);

    for (const missing of missingIndexes) {
      gaps.push({
        id: '',
        area: 'missing-index',
        severity: 'major',
        description: `Required database index @@index([${missing.fields.join(', ')}]) is missing from model "${missing.model}" in prisma/schema.prisma`,
        evidence_paths: [schemaPath],
        requirement_refs: ['project-completion-audit/7.4'],
        proposed_action: `Add @@index([${missing.fields.join(', ')}]) to the ${missing.model} model in prisma/schema.prisma`,
      });
    }
  } catch {
    // File read error — skip gracefully
  }
}

/**
 * Requirement 7.5: Verify security headers and session cookie settings.
 */
async function scanSecurityHeaders(ctx: ScannerContext, gaps: GapItem[]): Promise<void> {
  // Check next.config.mjs for security headers
  const nextConfigPath = 'next.config.mjs';
  if (await ctx.fileExists(nextConfigPath)) {
    try {
      const content = await ctx.readFile(nextConfigPath);
      const { hasHsts, hasNoSniff } = hasSecurityHeaders(content);

      if (!hasHsts || !hasNoSniff) {
        const missingHeaders: string[] = [];
        if (!hasHsts) missingHeaders.push('Strict-Transport-Security');
        if (!hasNoSniff) missingHeaders.push('X-Content-Type-Options: nosniff');

        gaps.push({
          id: '',
          area: 'security-headers',
          severity: 'major',
          description: `next.config.mjs is missing security headers: ${missingHeaders.join(', ')}`,
          evidence_paths: [nextConfigPath],
          requirement_refs: ['project-completion-audit/7.5'],
          proposed_action: `Add a headers() function to next.config.mjs that returns Strict-Transport-Security and X-Content-Type-Options: nosniff headers for all routes`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }

  // Check lib/auth.ts for secure cookie settings
  const authPath = 'lib/auth.ts';
  if (await ctx.fileExists(authPath)) {
    try {
      const content = await ctx.readFile(authPath);
      const { hasHttpOnly, hasSecure } = hasSecureCookieSettings(content);

      if (!hasHttpOnly || !hasSecure) {
        const missingSettings: string[] = [];
        if (!hasHttpOnly) missingSettings.push('httpOnly: true');
        if (!hasSecure) missingSettings.push('secure: true');

        gaps.push({
          id: '',
          area: 'security-headers',
          severity: 'major',
          description: `Session cookies in lib/auth.ts are missing secure settings: ${missingSettings.join(', ')}`,
          evidence_paths: [authPath],
          requirement_refs: ['project-completion-audit/7.5'],
          proposed_action: `Update cookie settings in lib/auth.ts to include httpOnly: true and secure: true for all session cookies`,
        });
      }
    } catch {
      // File read error — skip gracefully
    }
  }
}

export default nfrScanner;

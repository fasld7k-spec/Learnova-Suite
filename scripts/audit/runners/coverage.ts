/**
 * Coverage Runner — executes `npm run test:coverage -- --run`, parses coverage output,
 * detects missing test files, and checks E2E test presence.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { CoverageEntry, GapItem } from '../types';

export interface CoverageRunnerResult {
  coverage: CoverageEntry[];
  gaps: GapItem[];
}

/** Timeout for the coverage command in milliseconds (300 seconds). */
const COVERAGE_TIMEOUT_MS = 300_000;

/** Coverage threshold for payment gateway files. */
const PAYMENT_GATEWAY_THRESHOLD = 80;

/** Coverage threshold for critical core files. */
const CORE_THRESHOLD = 80;

/** Critical core files that must meet the coverage threshold. */
const CRITICAL_CORE_FILES = [
  'lib/auth.ts',
  'lib/2fa.ts',
  'lib/oauth.ts',
  'lib/cache.ts',
  'lib/email.ts',
  'lib/webhooks.ts',
];

/** Files excluded from the "no-test-file" detection. */
const TEST_FILE_EXCLUSIONS = [
  'lib/constants.ts',
  'lib/prisma.ts',
];

/** Required E2E test files. */
const REQUIRED_E2E_FILES = [
  'student-journey.spec.ts',
  'instructor-journey.spec.ts',
  'admin-journey.spec.ts',
];

/**
 * Determines whether a coverage gap should be emitted for a given file path and line coverage.
 * Returns true if coverage is below the applicable threshold:
 * - 80% for files under `lib/payment-gateways/`
 * - 80% for critical core files (`lib/auth.ts`, `lib/2fa.ts`, `lib/oauth.ts`, `lib/cache.ts`, `lib/email.ts`, `lib/webhooks.ts`)
 * - Returns false for all other files (no threshold applies)
 *
 * Exported for property testing (Property 10).
 */
export function shouldEmitCoverageGap(filePath: string, lineCoverage: number): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  // Check payment gateway files
  if (normalized.startsWith('lib/payment-gateways/')) {
    return lineCoverage < PAYMENT_GATEWAY_THRESHOLD;
  }

  // Check critical core files
  if (CRITICAL_CORE_FILES.includes(normalized)) {
    return lineCoverage < CORE_THRESHOLD;
  }

  return false;
}

/**
 * Determines whether a lib file is a type-only file (contains only type/interface exports).
 * A file is considered type-only if it has no runtime exports (only `export type` or `export interface`).
 */
async function isTypeOnlyFile(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    // Check if file has any runtime exports (not just type/interface)
    const hasRuntimeExport = lines.some(line => {
      const trimmed = line.trim();
      // Skip type-only exports
      if (trimmed.startsWith('export type ') || trimmed.startsWith('export interface ')) {
        return false;
      }
      // Any other export is a runtime export
      if (trimmed.startsWith('export ') || trimmed.startsWith('export{')) {
        return true;
      }
      return false;
    });

    return !hasRuntimeExport;
  } catch {
    return false;
  }
}

/**
 * Runs `npm run test:coverage -- --run` and parses the coverage output.
 * Also detects missing test files for lib/ modules and missing E2E test files.
 */
export async function runCoverage(workspaceRoot: string): Promise<CoverageRunnerResult> {
  const gaps: GapItem[] = [];

  // Execute coverage command and parse results
  const { output, exitCode } = await executeCoverageCommand(workspaceRoot);
  const coverage = parseCoverageOutput(output);

  // Emit gaps for low coverage in payment gateway files (Req 5.2)
  emitPaymentCoverageGaps(coverage, gaps);

  // Emit gaps for low coverage in critical core files (Req 5.3)
  emitCoreCoverageGaps(coverage, gaps);

  // Detect missing test files for lib/ modules (Req 5.4)
  await detectMissingTestFiles(workspaceRoot, gaps);

  // Detect missing E2E test files (Req 5.5)
  await detectMissingE2EFiles(workspaceRoot, gaps);

  return { coverage, gaps };
}

/**
 * Executes `npm run test:coverage -- --run` and returns the combined output.
 */
function executeCoverageCommand(cwd: string): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = exec(
      'npm run test:coverage -- --run',
      { cwd, timeout: COVERAGE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error: Error | null, stdout: string, stderr: string) => {
        const output = (stdout ?? '') + (stderr ?? '');

        if (error) {
          const execError = error as NodeJS.ErrnoException & { killed?: boolean; code?: string | number };
          if (execError.killed) {
            resolve({ output: output + '\n[COVERAGE TIMED OUT after 300s]', exitCode: -1 });
            return;
          }
          if (execError.code === 'ENOENT') {
            resolve({ output: 'npm command not found', exitCode: -1 });
            return;
          }
          const exitCode = typeof execError.code === 'number' ? execError.code : 1;
          resolve({ output, exitCode });
          return;
        }

        resolve({ output, exitCode: 0 });
      }
    );

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore kill errors
      }
    }, COVERAGE_TIMEOUT_MS + 5000);

    child.on('close', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Parses Vitest/Istanbul coverage text output into CoverageEntry objects.
 * Handles the standard table format:
 *
 * ----------|---------|----------|---------|---------|
 * File      | % Stmts | % Branch | % Funcs | % Lines |
 * ----------|---------|----------|---------|---------|
 * All files |   75.5  |    60.2  |   80.1  |   74.3  |
 *  lib      |   70.0  |    55.0  |   75.0  |   68.0  |
 *  lib/auth |   90.0  |    85.0  |   95.0  |   88.0  |
 * ----------|---------|----------|---------|---------|
 */
export function parseCoverageOutput(output: string): CoverageEntry[] {
  const entries: CoverageEntry[] = [];
  const lines = output.split('\n');

  // Look for coverage table lines with percentage values
  // Format: " dirname | stmts% | branch% | funcs% | lines% | uncovered"
  const tableLineRegex = /^\s*(.+?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/;

  for (const line of lines) {
    const match = tableLineRegex.exec(line);
    if (!match) continue;

    const directory = match[1].trim();

    // Skip header lines, separator lines, and "All files" summary
    if (
      directory === 'File' ||
      directory === 'All files' ||
      directory.startsWith('-') ||
      directory.startsWith('=') ||
      directory === ''
    ) {
      continue;
    }

    const stmts = parseFloat(match[2]);
    const branch = parseFloat(match[3]);
    const funcs = parseFloat(match[4]);
    const lineCov = parseFloat(match[5]);

    if (isNaN(stmts) || isNaN(branch) || isNaN(funcs) || isNaN(lineCov)) continue;

    entries.push({
      directory,
      line_coverage: lineCov,
      branch_coverage: branch,
      function_coverage: funcs,
    });
  }

  return entries;
}

/**
 * Emits GapItems for payment gateway files with coverage below 80%.
 */
function emitPaymentCoverageGaps(coverage: CoverageEntry[], gaps: GapItem[]): void {
  for (const entry of coverage) {
    const normalized = entry.directory.replace(/\\/g, '/');
    if (normalized.startsWith('lib/payment-gateways/') || normalized === 'lib/payment-gateways') {
      if (entry.line_coverage < PAYMENT_GATEWAY_THRESHOLD) {
        gaps.push({
          id: '',
          area: 'low-coverage-payments',
          severity: 'major',
          description: `Payment gateway file "${entry.directory}" has ${entry.line_coverage}% line coverage (threshold: ${PAYMENT_GATEWAY_THRESHOLD}%)`,
          evidence_paths: [normalized],
          requirement_refs: ['project-completion-audit/5.2'],
          proposed_action: `Add tests to increase line coverage of ${entry.directory} to at least ${PAYMENT_GATEWAY_THRESHOLD}%`,
        });
      }
    }
  }
}

/**
 * Emits GapItems for critical core files with coverage below threshold.
 */
function emitCoreCoverageGaps(coverage: CoverageEntry[], gaps: GapItem[]): void {
  for (const entry of coverage) {
    const normalized = entry.directory.replace(/\\/g, '/');
    if (CRITICAL_CORE_FILES.includes(normalized)) {
      if (entry.line_coverage < CORE_THRESHOLD) {
        gaps.push({
          id: '',
          area: 'low-coverage-core',
          severity: 'major',
          description: `Critical core file "${entry.directory}" has ${entry.line_coverage}% line coverage (threshold: ${CORE_THRESHOLD}%)`,
          evidence_paths: [normalized],
          requirement_refs: ['project-completion-audit/5.3'],
          proposed_action: `Add tests to increase line coverage of ${entry.directory} to at least ${CORE_THRESHOLD}%`,
        });
      }
    }
  }
}

/**
 * Detects lib/ modules that have no corresponding test file under tests/unit/lib/.
 * Excludes files in the exclusion list and type-only files.
 */
async function detectMissingTestFiles(workspaceRoot: string, gaps: GapItem[]): Promise<void> {
  const libDir = path.join(workspaceRoot, 'lib');
  const unitTestDir = path.join(workspaceRoot, 'tests', 'unit', 'lib');

  let libFiles: string[];
  try {
    const entries = await fs.readdir(libDir, { withFileTypes: true });
    libFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.ts'))
      .map(e => e.name);
  } catch {
    return; // lib/ directory doesn't exist, skip
  }

  let existingTests: string[];
  try {
    const entries = await fs.readdir(unitTestDir, { withFileTypes: true });
    existingTests = entries
      .filter(e => e.isFile() && e.name.endsWith('.test.ts'))
      .map(e => e.name);
  } catch {
    existingTests = []; // No test directory yet
  }

  for (const libFile of libFiles) {
    const libPath = `lib/${libFile}`;

    // Skip excluded files
    if (TEST_FILE_EXCLUSIONS.includes(libPath)) continue;

    // Check if it's a type-only file
    const fullPath = path.join(libDir, libFile);
    if (await isTypeOnlyFile(fullPath)) continue;

    // Check for corresponding test file
    const expectedTestName = libFile.replace(/\.ts$/, '.test.ts');
    if (!existingTests.includes(expectedTestName)) {
      gaps.push({
        id: '',
        area: 'no-test-file',
        severity: 'minor',
        description: `No unit test file found for "${libPath}". Expected: tests/unit/lib/${expectedTestName}`,
        evidence_paths: [libPath],
        requirement_refs: ['project-completion-audit/5.4'],
        proposed_action: `Create tests/unit/lib/${expectedTestName} with unit tests for ${libPath}`,
      });
    }
  }
}

/**
 * Detects missing required E2E test files and E2E files with zero test blocks.
 */
async function detectMissingE2EFiles(workspaceRoot: string, gaps: GapItem[]): Promise<void> {
  const e2eDir = path.join(workspaceRoot, 'tests', 'e2e');

  for (const requiredFile of REQUIRED_E2E_FILES) {
    const filePath = path.join(e2eDir, requiredFile);
    const relativePath = `tests/e2e/${requiredFile}`;

    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Check if file contains at least one test( block
      if (!content.includes('test(') && !content.includes('test.describe(')) {
        gaps.push({
          id: '',
          area: 'missing-e2e',
          severity: 'major',
          description: `E2E test file "${relativePath}" exists but contains zero test blocks`,
          evidence_paths: [relativePath],
          requirement_refs: ['project-completion-audit/5.5'],
          proposed_action: `Add test cases to ${relativePath}`,
        });
      }
    } catch {
      // File doesn't exist
      gaps.push({
        id: '',
        area: 'missing-e2e',
        severity: 'major',
        description: `Required E2E test file "${relativePath}" is missing`,
        evidence_paths: [relativePath],
        requirement_refs: ['project-completion-audit/5.5'],
        proposed_action: `Create ${relativePath} with end-to-end journey tests`,
      });
    }
  }
}

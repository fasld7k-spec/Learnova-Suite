/**
 * Core type definitions and interfaces for the Project Completion Audit system.
 * Requirements: 1.2, 1.3, 1.4, 4.7
 */

// --- Enums / Union Types ---

export type Severity = 'blocker' | 'major' | 'minor';
export type ModuleStatus = 'complete' | 'partial' | 'untested' | 'missing';

// --- Interfaces ---

export interface GapItem {
  id: string;                    // Unique identifier: "{area}-{sequential}"
  area: string;                  // Category (e.g., "spec-drift", "lint", "dead-export")
  severity: Severity;
  description: string;
  evidence_paths: string[];      // Relative paths with forward slashes
  requirement_refs: string[];    // e.g., ["learnova-platform-development-plan/1.2"]
  proposed_action: string;
}

export interface ModuleEntry {
  path: string;                  // Relative path (e.g., "app/admin")
  file_count: number;
  recently_modified_count: number; // Modified in last 30 days
  status: ModuleStatus;
}

export interface ToolResult {
  exit_code: number;
  errors: number;
  warnings: number;
  duration_seconds?: number;
  output_tail?: string[];        // Last 50 lines for build
}

export interface TestResult {
  exit_code: number;
  passing: number;
  failing: number;
  skipped: number;
}

export interface CoverageEntry {
  directory: string;
  line_coverage: number;
  branch_coverage: number;
  function_coverage: number;
}

export interface AuditReport {
  generated_at: string;          // ISO 8601 UTC
  commit: string;                // Git SHA or "unknown"
  production_ready: boolean;
  summary: {
    total: number;
    complete: number;
    partial: number;
    untested: number;
    missing: number;
    completion_percentage: number; // Rounded to 1 decimal
  };
  modules: ModuleEntry[];
  gaps: GapItem[];
  lint: ToolResult;
  types: ToolResult;
  build: ToolResult;
  tests: TestResult;
  coverage: CoverageEntry[];
  requirements_without_tests: string[];
  cleanup: GapItem[];            // Subset where area starts with "stale-" or "dead-"
}

export interface ScannerContext {
  workspaceRoot: string;
  readFile: (path: string) => Promise<string>;
  fileExists: (path: string) => Promise<boolean>;
  listDir: (path: string, depth?: number) => Promise<string[]>;
  glob: (pattern: string) => Promise<string[]>;
}

export interface Scanner {
  name: string;
  scan(ctx: ScannerContext): Promise<GapItem[]>;
}

// --- Utility Functions ---

/**
 * Assigns deterministic IDs to gap items.
 * Sorts gaps by area then by first evidence_path, then assigns
 * zero-padded sequential IDs per area.
 */
export function generateGapIds(gaps: GapItem[]): GapItem[] {
  const counters = new Map<string, number>();
  return gaps
    .sort((a, b) =>
      a.area.localeCompare(b.area) ||
      (a.evidence_paths[0] ?? '').localeCompare(b.evidence_paths[0] ?? '')
    )
    .map(gap => {
      const count = (counters.get(gap.area) ?? 0) + 1;
      counters.set(gap.area, count);
      return { ...gap, id: `${gap.area}-${String(count).padStart(3, '0')}` };
    });
}

/**
 * Computes the `production_ready` flag for the audit report.
 * Returns true if and only if:
 * - lint errors = 0
 * - type errors = 0
 * - build exit code = 0
 * - failing tests = 0
 * - zero blocker gaps
 */
export function computeProductionReady(report: Partial<AuditReport>): boolean {
  return (
    (report.lint?.errors ?? 1) === 0 &&
    (report.types?.errors ?? 1) === 0 &&
    (report.build?.exit_code ?? 1) === 0 &&
    (report.tests?.failing ?? 1) === 0 &&
    (report.gaps ?? []).filter(g => g.severity === 'blocker').length === 0
  );
}

/**
 * Computes the summary section from the modules array.
 * completion_percentage = round((complete / total) * 100, 1)
 */
export function computeSummary(modules: ModuleEntry[]): AuditReport['summary'] {
  const total = modules.length;
  const complete = modules.filter(m => m.status === 'complete').length;
  const partial = modules.filter(m => m.status === 'partial').length;
  const untested = modules.filter(m => m.status === 'untested').length;
  const missing = modules.filter(m => m.status === 'missing').length;
  const completion_percentage = total > 0
    ? Math.round((complete / total) * 1000) / 10
    : 0;
  return { total, complete, partial, untested, missing, completion_percentage };
}

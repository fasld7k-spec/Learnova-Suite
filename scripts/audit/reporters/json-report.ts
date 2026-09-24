/**
 * JSON Report Generator — aggregates all audit data, computes summary,
 * determines production_ready flag, and writes audit-report.json.
 * Requirements: 1.1, 1.2, 1.3, 1.5, 4.7, 6.5
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  AuditReport,
  CoverageEntry,
  GapItem,
  ModuleEntry,
  TestResult,
  ToolResult,
} from '../types';
import {
  computeProductionReady,
  computeSummary,
  generateGapIds,
} from '../types';
import { getGitSha } from '../utils';

/**
 * Input data collected from all scanners and tool runners.
 */
export interface JsonReportInput {
  modules: ModuleEntry[];
  gaps: GapItem[];
  lint: ToolResult;
  types: ToolResult;
  build: ToolResult;
  tests: TestResult;
  coverage: CoverageEntry[];
  requirements_without_tests: string[];
}

/**
 * Generates the complete AuditReport object from collected data.
 *
 * Steps:
 * 1. Assigns deterministic IDs to all gaps via generateGapIds
 * 2. Computes production_ready flag via computeProductionReady
 * 3. Computes summary from modules via computeSummary
 * 4. Builds the cleanup section (gaps where area starts with "stale-" or "dead-")
 * 5. Writes the JSON to .kiro/specs/project-completion-audit/audit-report.json
 * 6. Returns the complete AuditReport object
 */
export async function generateJsonReport(
  input: JsonReportInput,
  workspaceRoot: string
): Promise<AuditReport> {
  // Step 1: Assign deterministic IDs to all gaps
  const gaps = generateGapIds(input.gaps);

  // Step 2: Compute production_ready flag
  const production_ready = computeProductionReady({
    lint: input.lint,
    types: input.types,
    build: input.build,
    tests: input.tests,
    gaps,
  });

  // Step 3: Compute summary from modules
  const summary = computeSummary(input.modules);

  // Step 4: Build the cleanup section (gaps where area starts with "stale-" or "dead-")
  const cleanup = gaps.filter(
    (g) => g.area.startsWith('stale-') || g.area.startsWith('dead-')
  );

  // Build the complete report
  const report: AuditReport = {
    generated_at: new Date().toISOString(),
    commit: await getGitSha(),
    production_ready,
    summary,
    modules: input.modules,
    gaps,
    lint: input.lint,
    types: input.types,
    build: input.build,
    tests: input.tests,
    coverage: input.coverage,
    requirements_without_tests: input.requirements_without_tests,
    cleanup,
  };

  // Step 5: Write the JSON to the output path
  const outputDir = path.join(workspaceRoot, '.kiro', 'specs', 'project-completion-audit');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'audit-report.json');
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

  // Step 6: Return the complete AuditReport object
  return report;
}

/**
 * Markdown Report Generator — produces a human-readable audit-report.md
 * with executive summary, top risk files, and spec coverage sections.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { AuditReport, GapItem } from '../types';

/**
 * Generates the Markdown report from a complete AuditReport object.
 * Writes to `.kiro/specs/project-completion-audit/audit-report.md`.
 *
 * Sections:
 * 1. Executive Summary table (Requirement 10.1)
 * 2. Top 10 Files By Risk (Requirement 10.2)
 * 3. Spec Coverage per Prior_Spec (Requirement 10.3)
 *
 * All paths are relative with forward slashes (Requirement 10.4).
 * Excerpts are limited to 5 lines per evidence entry (Requirement 10.5).
 */
export async function generateMdReport(
  report: AuditReport,
  workspaceRoot: string
): Promise<string> {
  const md = buildMarkdown(report);

  const outputDir = path.join(workspaceRoot, '.kiro', 'specs', 'project-completion-audit');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'audit-report.md');
  await fs.writeFile(outputPath, md, 'utf8');

  return md;
}

/**
 * Builds the complete Markdown string from the AuditReport.
 * This is a pure function for testability.
 */
export function buildMarkdown(report: AuditReport): string {
  const sections: string[] = [];

  sections.push('# Audit Report');
  sections.push('');
  sections.push(`Generated: ${report.generated_at}  `);
  sections.push(`Commit: \`${report.commit}\``);
  sections.push('');

  // Section 1: Executive Summary (Requirement 10.1)
  sections.push(buildExecutiveSummary(report));

  // Section 2: Top 10 Files By Risk (Requirement 10.2)
  sections.push(buildTopFilesByRisk(report.gaps));

  // Section 3: Spec Coverage (Requirement 10.3)
  sections.push(buildSpecCoverage(report));

  return sections.join('\n');
}

/**
 * Builds the executive summary table.
 * Contains: total gaps, blockers, majors, minors, coverage %, build status, production_ready.
 * Requirement 10.1
 */
function buildExecutiveSummary(report: AuditReport): string {
  const blockers = report.gaps.filter((g) => g.severity === 'blocker').length;
  const majors = report.gaps.filter((g) => g.severity === 'major').length;
  const minors = report.gaps.filter((g) => g.severity === 'minor').length;
  const totalGaps = report.gaps.length;

  // Compute average line coverage percentage across all coverage entries
  const coveragePercent =
    report.coverage.length > 0
      ? Math.round(
          (report.coverage.reduce((sum, c) => sum + c.line_coverage, 0) /
            report.coverage.length) *
            10
        ) / 10
      : 0;

  const buildStatus = report.build.exit_code === 0 ? 'passing' : 'failing';
  const productionReady = report.production_ready ? '✅ Yes' : '❌ No';

  const lines: string[] = [];
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Gaps | ${totalGaps} |`);
  lines.push(`| Blockers | ${blockers} |`);
  lines.push(`| Majors | ${majors} |`);
  lines.push(`| Minors | ${minors} |`);
  lines.push(`| Line Coverage | ${coveragePercent}% |`);
  lines.push(`| Build Status | ${buildStatus} |`);
  lines.push(`| Production Ready | ${productionReady} |`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Builds the "Top 10 Files By Risk" section.
 * Lists the ten files with the highest combined count of associated Gap_Item entries.
 * Each file is linked to its evidence paths.
 * Requirement 10.2
 */
function buildTopFilesByRisk(gaps: GapItem[]): string {
  // Count how many gap items reference each file path
  const fileCounts = new Map<string, number>();

  for (const gap of gaps) {
    for (const evidencePath of gap.evidence_paths) {
      fileCounts.set(evidencePath, (fileCounts.get(evidencePath) ?? 0) + 1);
    }
  }

  // Sort by count descending, then by path alphabetically for stability
  const sorted = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);

  const lines: string[] = [];
  lines.push('## Top 10 Files By Risk');
  lines.push('');

  if (sorted.length === 0) {
    lines.push('No files with associated gaps found.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| # | File | Gap Count |');
  lines.push('|---|------|-----------|');

  for (let i = 0; i < sorted.length; i++) {
    const [filePath, count] = sorted[i];
    lines.push(`| ${i + 1} | \`${filePath}\` | ${count} |`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Builds the "Spec Coverage" section.
 * Shows per Prior_Spec the percentage of acceptance-criteria identifiers
 * that have at least one corresponding test.
 * Requirement 10.3
 */
function buildSpecCoverage(report: AuditReport): string {
  // Extract all requirement refs from gaps to identify Prior_Specs
  // requirement_refs format: "learnova-platform-development-plan/1.2"
  const specRequirements = new Map<string, Set<string>>();

  // Collect all requirement references from all gaps
  for (const gap of report.gaps) {
    for (const ref of gap.requirement_refs) {
      const slashIndex = ref.indexOf('/');
      if (slashIndex > 0) {
        const specName = ref.substring(0, slashIndex);
        if (!specRequirements.has(specName)) {
          specRequirements.set(specName, new Set());
        }
        specRequirements.get(specName)!.add(ref);
      }
    }
  }

  // requirements_without_tests also tells us which specs have untested requirements
  const untestedBySpec = new Map<string, Set<string>>();
  const allReqsBySpec = new Map<string, Set<string>>();

  for (const ref of report.requirements_without_tests) {
    const slashIndex = ref.indexOf('/');
    if (slashIndex > 0) {
      const specName = ref.substring(0, slashIndex);
      if (!untestedBySpec.has(specName)) {
        untestedBySpec.set(specName, new Set());
      }
      untestedBySpec.get(specName)!.add(ref);

      // Track all known requirements per spec
      if (!allReqsBySpec.has(specName)) {
        allReqsBySpec.set(specName, new Set());
      }
      allReqsBySpec.get(specName)!.add(ref);
    }
  }

  // Also add requirements that DO have tests (from gap requirement_refs that are NOT in requirements_without_tests)
  const untestedSet = new Set(report.requirements_without_tests);
  for (const gap of report.gaps) {
    for (const ref of gap.requirement_refs) {
      const slashIndex = ref.indexOf('/');
      if (slashIndex > 0) {
        const specName = ref.substring(0, slashIndex);
        if (!allReqsBySpec.has(specName)) {
          allReqsBySpec.set(specName, new Set());
        }
        allReqsBySpec.get(specName)!.add(ref);
      }
    }
  }

  const lines: string[] = [];
  lines.push('## Spec Coverage');
  lines.push('');

  // Get all unique spec names from both sources
  const allSpecs = new Set([...allReqsBySpec.keys(), ...untestedBySpec.keys()]);

  if (allSpecs.size === 0) {
    lines.push('No Prior_Spec requirement references found.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Spec | Total Requirements | Tested | Coverage |');
  lines.push('|------|-------------------|--------|----------|');

  // Sort spec names for deterministic output
  const sortedSpecs = [...allSpecs].sort();

  for (const specName of sortedSpecs) {
    const totalReqs = allReqsBySpec.get(specName)?.size ?? 0;
    const untestedCount = untestedBySpec.get(specName)?.size ?? 0;
    const testedCount = totalReqs - untestedCount;
    const coveragePercent =
      totalReqs > 0 ? Math.round((testedCount / totalReqs) * 1000) / 10 : 0;

    lines.push(
      `| ${specName} | ${totalReqs} | ${testedCount} | ${coveragePercent}% |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

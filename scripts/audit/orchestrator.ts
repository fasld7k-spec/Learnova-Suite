/**
 * Audit Orchestrator — coordinates all scanners, tool runners, and report generators.
 * Implements the main audit pipeline: scan → run tools → generate reports → exit code.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import type { GapItem, TestResult, ToolResult, CoverageEntry, ModuleEntry } from './types';
import { buildScannerContext } from './utils';

// Scanners
import { inventoryScanner, getModuleEntries } from './scanners/inventory';
import { specVerificationScanner, getRequirementsWithoutTests } from './scanners/spec-verification';
import { partialImplScanner } from './scanners/partial-impl';
import { deadCodeScanner } from './scanners/dead-code';
import { nfrScanner } from './scanners/nfr';

// Runners
import { runLint } from './runners/lint';
import { runTypeChecker } from './runners/types';
import { runBuild } from './runners/build';
import { runTests } from './runners/tests';
import { runCoverage } from './runners/coverage';

// Reporters
import { generateJsonReport } from './reporters/json-report';
import { generateMdReport } from './reporters/md-report';
import { renderCompletionPlan } from './reporters/completion-plan';

import fs from 'node:fs/promises';
import path from 'node:path';

export interface AuditOrchestratorConfig {
  ci: boolean;
  workspaceRoot: string;
}

export class AuditOrchestrator {
  private config: AuditOrchestratorConfig;

  constructor(config: AuditOrchestratorConfig) {
    this.config = config;
  }

  async run(): Promise<number> {
    const { workspaceRoot } = this.config;
    const ctx = buildScannerContext(workspaceRoot);
    const gaps: GapItem[] = [];

    // Phase 1: Run scanners sequentially with error handling
    const scanners = [
      inventoryScanner,
      specVerificationScanner,
      partialImplScanner,
      deadCodeScanner,
      nfrScanner,
    ];

    for (const scanner of scanners) {
      try {
        const scannerGaps = await scanner.scan(ctx);
        gaps.push(...scannerGaps);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[audit] Scanner "${scanner.name}" failed: ${message}`);
        gaps.push({
          id: '',
          area: 'audit-internal-error',
          severity: 'major',
          description: `Scanner "${scanner.name}" threw an error: ${message}`,
          evidence_paths: [],
          requirement_refs: [],
          proposed_action: `Investigate and fix the "${scanner.name}" scanner error`,
        });
      }
    }

    // Phase 2: Run tool runners
    const lintResult = await runLint(workspaceRoot);
    gaps.push(...lintResult.gaps);

    const typesResult = await runTypeChecker(workspaceRoot);
    gaps.push(...typesResult.gaps);

    const buildResult = await runBuild(workspaceRoot);
    gaps.push(...buildResult.gaps);

    const testsResult = await runTests(workspaceRoot);
    gaps.push(...testsResult.gaps);

    const coverageResult = await runCoverage(workspaceRoot);
    gaps.push(...coverageResult.gaps);

    // Phase 3: Collect additional data for the report
    const modules: ModuleEntry[] = await getModuleEntries(ctx);
    const requirementsWithoutTests: string[] = await getRequirementsWithoutTests(ctx);

    // Phase 4: Generate reports
    const lint: ToolResult = lintResult.toolResult;
    const types: ToolResult = typesResult.toolResult;
    const build: ToolResult = buildResult.toolResult;
    const tests: TestResult = testsResult.testResult;
    const coverage: CoverageEntry[] = coverageResult.coverage;

    const report = await generateJsonReport(
      {
        modules,
        gaps,
        lint,
        types,
        build,
        tests,
        coverage,
        requirements_without_tests: requirementsWithoutTests,
      },
      workspaceRoot,
    );

    await generateMdReport(report, workspaceRoot);

    // Generate completion plan
    const completionPlanMd = renderCompletionPlan(report.gaps, report.production_ready);
    const outputDir = path.join(workspaceRoot, '.kiro', 'specs', 'project-completion-audit');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'completion-plan.md'), completionPlanMd, 'utf8');

    // Phase 5: Exit code logic
    if (this.config.ci && !report.production_ready) {
      return 1;
    }
    return 0;
  }
}

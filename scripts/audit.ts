/**
 * CLI Entry Point for the Project Completion Audit tool.
 * Invoked via: tsx scripts/audit.ts [--ci]
 *
 * Parses the --ci flag, instantiates AuditOrchestrator, and exits
 * with the returned code. Unhandled errors print to stderr and exit with code 2.
 *
 * Requirements: 9.1, 9.3
 */

import { AuditOrchestrator } from './audit/orchestrator';

const ci = process.argv.includes('--ci');
const orchestrator = new AuditOrchestrator({ ci, workspaceRoot: process.cwd() });

orchestrator.run().then(
  (exitCode) => {
    process.exit(exitCode);
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[audit] Fatal error: ${message}\n`);
    process.exit(2);
  },
);

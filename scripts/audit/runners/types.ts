/**
 * TypeScript type checker runner for the Project Completion Audit system.
 * Executes `npx tsc --noEmit --pretty false`, parses output for type errors,
 * and returns a ToolResult plus GapItem[] for each violation.
 * Requirements: 4.3, 4.4
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { normalizePath } from '../utils';
import type { GapItem, ToolResult } from '../types';

/** Timeout for the tsc process in milliseconds (300 seconds). */
const TSC_TIMEOUT_MS = 300_000;

/** Regex to parse TypeScript error output in `--pretty false` format. */
// Format: file(line,col): error TSxxxx: message
const TSC_ERROR_REGEX = /^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

export interface TypesRunnerResult {
  toolResult: ToolResult;
  gaps: GapItem[];
}

/**
 * Runs `npx tsc --noEmit --pretty false` and parses the output.
 * Returns a ToolResult with exit code and error count, plus one GapItem per type error.
 */
export async function runTypeChecker(workspaceRoot: string): Promise<TypesRunnerResult> {
  const startTime = Date.now();

  try {
    const { stdout, stderr, exitCode } = await executeTsc(workspaceRoot);
    const durationSeconds = (Date.now() - startTime) / 1000;
    const output = (stdout + '\n' + stderr).trim();
    const lines = output.split('\n').filter(line => line.trim().length > 0);

    const gaps: GapItem[] = [];

    for (const line of lines) {
      const match = TSC_ERROR_REGEX.exec(line);
      if (!match) continue;

      const [, filePath, lineNum, _col, tsCode, message] = match;
      const normalized = normalizePath(filePath.trim(), workspaceRoot);
      if (normalized === null) continue;

      gaps.push({
        id: '', // Will be assigned by generateGapIds
        area: 'types',
        severity: 'blocker',
        description: `${tsCode} at ${normalized}:${lineNum} — ${message.trim()}`,
        evidence_paths: [normalized],
        requirement_refs: ['project-completion-audit/4.3', 'project-completion-audit/4.4'],
        proposed_action: `Fix type error ${tsCode} in ${normalized} at line ${lineNum}`,
      });
    }

    return {
      toolResult: {
        exit_code: exitCode,
        errors: gaps.length,
        warnings: 0,
        duration_seconds: Math.round(durationSeconds * 100) / 100,
      },
      gaps,
    };
  } catch (error: unknown) {
    const durationSeconds = (Date.now() - startTime) / 1000;

    // Handle timeout or command-not-found
    const isTimeout = error instanceof Error && 'killed' in error && (error as { killed: boolean }).killed;
    const description = isTimeout
      ? 'TypeScript type checker timed out after 300 seconds'
      : `TypeScript type checker failed to execute: ${error instanceof Error ? error.message : String(error)}`;

    return {
      toolResult: {
        exit_code: -1,
        errors: 0,
        warnings: 0,
        duration_seconds: Math.round(durationSeconds * 100) / 100,
      },
      gaps: [
        {
          id: '',
          area: 'types',
          severity: 'blocker',
          description,
          evidence_paths: [],
          requirement_refs: ['project-completion-audit/4.3'],
          proposed_action: 'Ensure TypeScript compiler (tsc) is available and tsconfig.json is valid',
        },
      ],
    };
  }
}

/**
 * Executes `npx tsc --noEmit --pretty false` and returns stdout, stderr, and exit code.
 * Handles the fact that tsc exits with non-zero when there are type errors (expected behavior).
 */
function executeTsc(
  workspaceRoot: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const tscBin = path.join(workspaceRoot, 'node_modules', 'typescript', 'bin', 'tsc');

    const child = execFile(
      process.execPath,
      [tscBin, '--noEmit', '--pretty', 'false'],
      {
        cwd: workspaceRoot,
        timeout: TSC_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10 MB buffer for large projects
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          // tsc exits with non-zero when there are type errors — this is expected
          if ('code' in error && typeof error.code === 'number') {
            resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: error.code });
            return;
          }
          // Timeout: error.killed is true
          if (error.killed) {
            reject(error);
            return;
          }
          // Command not found or other spawn error
          if ('code' in error && error.code === 'ENOENT') {
            reject(new Error('npx command not found'));
            return;
          }
          // Other exec errors with stdout/stderr available
          if (stdout || stderr) {
            resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 1 });
            return;
          }
          reject(error);
          return;
        }
        // Success: no type errors
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 });
      }
    );

    // Safety: ensure child process is killed on timeout
    child.on('error', (err) => {
      reject(err);
    });
  });
}

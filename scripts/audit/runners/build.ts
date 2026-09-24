/**
 * Build Runner — executes `npm run build` and records results.
 * Requirements: 4.5, 4.6
 */

import { exec, type ExecException } from 'node:child_process';
import type { GapItem, ToolResult } from '../types';

export interface BuildRunnerResult {
  toolResult: ToolResult;
  gaps: GapItem[];
}

const BUILD_TIMEOUT_MS = 300_000; // 300 seconds

/**
 * Runs `npm run build` in the given workspace root directory.
 * Records exit code, duration in seconds, and last 50 lines of combined output.
 * If the build fails, emits a GapItem with severity "blocker" and area "build".
 */
export async function runBuild(workspaceRoot: string): Promise<BuildRunnerResult> {
  const gaps: GapItem[] = [];
  const startTime = Date.now();

  const { exitCode, output } = await executeBuild(workspaceRoot);

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);
  const outputLines = output.split('\n');
  const outputTail = outputLines.slice(-50);

  const toolResult: ToolResult = {
    exit_code: exitCode,
    errors: exitCode !== 0 ? 1 : 0,
    warnings: 0,
    duration_seconds: durationSeconds,
    output_tail: outputTail,
  };

  if (exitCode !== 0) {
    const excerpt = outputTail.slice(-20).join('\n').trim();
    gaps.push({
      id: '',
      area: 'build',
      severity: 'blocker',
      description: `Build failed with exit code ${exitCode}. Excerpt:\n${excerpt}`,
      evidence_paths: [],
      requirement_refs: ['project-completion-audit/4.5', 'project-completion-audit/4.6'],
      proposed_action: 'Fix build errors so that `npm run build` exits with code 0.',
    });
  }

  return { toolResult, gaps };
}

/**
 * Executes `npm run build` as a child process with timeout handling.
 * Returns the exit code and combined stdout+stderr output.
 */
function executeBuild(cwd: string): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';

    const child = exec('npm run build', { cwd, shell, timeout: BUILD_TIMEOUT_MS, encoding: 'utf8' }, (error: ExecException | null, stdout: string, stderr: string) => {
      const output = (stdout ?? '') + (stderr ?? '');

      if (error) {
        // Check if it was a timeout (killed)
        if (error.killed) {
          resolve({ exitCode: -1, output: output + '\n[BUILD TIMED OUT after 300s]' });
          return;
        }
        // Command not found or other spawn error
        if ('code' in error && String(error.code) === 'ENOENT') {
          resolve({ exitCode: -1, output: 'npm command not found' });
          return;
        }
        // Normal non-zero exit
        const exitCode = error.code != null && typeof error.code === 'number' ? error.code : 1;
        resolve({ exitCode, output });
        return;
      }

      resolve({ exitCode: 0, output });
    });

    // Additional safety: kill on timeout if exec timeout doesn't trigger
    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore kill errors
      }
    }, BUILD_TIMEOUT_MS + 5000);

    child.on('close', () => {
      clearTimeout(timer);
    });
  });
}

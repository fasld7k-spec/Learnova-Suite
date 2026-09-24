/**
 * Lint Runner — executes `npm run lint` and parses ESLint output.
 * Returns a ToolResult with error/warning counts and emits GapItems per violation.
 * Requirements: 4.1, 4.2
 */

import { execFile } from 'node:child_process';
import { normalizePath } from '../utils';
import type { GapItem, ToolResult } from '../types';

export interface LintRunnerResult {
  toolResult: ToolResult;
  gaps: GapItem[];
}

interface LintViolation {
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  rule: string;
}

/**
 * Executes `npm run lint` and parses the output for ESLint violations.
 * Handles both default (stylish) and compact ESLint output formats.
 * Timeout: 300 seconds. Returns exit_code -1 if command not found.
 */
export async function runLint(workspaceRoot: string): Promise<LintRunnerResult> {
  const startTime = Date.now();

  let stdout = '';
  let stderr = '';
  let exitCode: number;

  try {
    const result = await executeCommand(workspaceRoot);
    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = result.exitCode;
  } catch (err: unknown) {
    // Command not found or timeout
    const duration = (Date.now() - startTime) / 1000;
    const isTimeout = err instanceof Error && err.message.includes('TIMEOUT');
    return {
      toolResult: {
        exit_code: -1,
        errors: 0,
        warnings: 0,
        duration_seconds: duration,
        output_tail: [isTimeout ? 'Lint command timed out after 300s' : 'Lint command not found or failed to execute'],
      },
      gaps: [],
    };
  }

  const duration = (Date.now() - startTime) / 1000;
  const output = stdout + stderr;
  const violations = parseEslintOutput(output);

  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warning').length;

  const gaps: GapItem[] = violations
    .filter(v => v.severity === 'error')
    .map(v => {
      const normalizedPath = normalizePath(v.filePath, workspaceRoot) ?? v.filePath;
      return {
        id: '', // Will be assigned by generateGapIds
        area: 'lint',
        severity: 'major' as const,
        description: `Lint error in ${normalizedPath}:${v.line} [${v.rule}]: ${v.message}`,
        evidence_paths: [normalizedPath],
        requirement_refs: ['project-completion-audit/4.1', 'project-completion-audit/4.2'],
        proposed_action: `Fix lint violation: ${v.rule} at ${normalizedPath}:${v.line}`,
      };
    });

  const outputLines = output.split('\n').filter(l => l.trim().length > 0);
  const outputTail = outputLines.slice(-50);

  return {
    toolResult: {
      exit_code: exitCode,
      errors,
      warnings,
      duration_seconds: duration,
      output_tail: outputTail,
    },
    gaps,
  };
}

/**
 * Executes `npm run lint` with a 300-second timeout.
 */
function executeCommand(cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : '/bin/sh';
    const shellArgs = isWindows ? ['/c', 'npm run lint'] : ['-c', 'npm run lint'];

    const child = execFile(shell, shellArgs, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 300_000, // 300 seconds
    }, (error, stdout, stderr) => {
      if (error) {
        // Check if it's a timeout
        if (error.killed || error.signal === 'SIGTERM') {
          reject(new Error('TIMEOUT: Lint command timed out after 300s'));
          return;
        }
        // Check if command not found
        if ('code' in error && error.code === 'ENOENT') {
          reject(new Error('ENOENT: Lint command not found'));
          return;
        }
        // ESLint exits with non-zero when there are errors — that's expected
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error.code && typeof error.code === 'number' ? error.code : 1,
        });
        return;
      }
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 });
    });

    // Safety: kill on timeout if the built-in timeout doesn't work
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('TIMEOUT: Lint command timed out after 300s'));
    }, 305_000);

    child.on('close', () => clearTimeout(timer));
  });
}

/**
 * Parses ESLint output in both default (stylish) and compact formats.
 *
 * Default/stylish format:
 *   /path/to/file.ts
 *     10:5  error  Some message  rule-name
 *     12:1  warning  Another message  other-rule
 *
 * Compact format:
 *   /path/to/file.ts: line 10, col 5, Error - Some message (rule-name)
 */
export function parseEslintOutput(output: string): LintViolation[] {
  const violations: LintViolation[] = [];
  const lines = output.split('\n');

  let currentFile = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Try stylish format: file path line (no leading whitespace, ends with extension)
    const fileMatch = line.match(/^([A-Za-z]:)?[/\\].*\.\w+$/);
    if (fileMatch) {
      currentFile = line.trim();
      continue;
    }

    // Try stylish format: "  line:col  severity  message  rule"
    const stylishMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S+)\s*$/);
    if (stylishMatch && currentFile) {
      violations.push({
        filePath: currentFile,
        line: parseInt(stylishMatch[1], 10),
        column: parseInt(stylishMatch[2], 10),
        severity: stylishMatch[3] as 'error' | 'warning',
        message: stylishMatch[4].trim(),
        rule: stylishMatch[5],
      });
      continue;
    }

    // Try compact format: "/path/to/file.ts: line 10, col 5, Error - message (rule)"
    const compactMatch = line.match(
      /^(.+?):\s*line\s+(\d+),\s*col\s+(\d+),\s*(Error|Warning)\s*-\s*(.+?)\s*\(([^)]+)\)\s*$/i
    );
    if (compactMatch) {
      violations.push({
        filePath: compactMatch[1].trim(),
        line: parseInt(compactMatch[2], 10),
        column: parseInt(compactMatch[3], 10),
        severity: compactMatch[4].toLowerCase() as 'error' | 'warning',
        message: compactMatch[5].trim(),
        rule: compactMatch[6].trim(),
      });
      continue;
    }

    // Try ESLint flat config / newer format: "/path/to/file.ts:10:5: message [severity/rule]"
    const flatMatch = line.match(
      /^(.+?):(\d+):(\d+):\s*(.+?)\s+\[(error|warning)\/([^\]]+)\]\s*$/i
    );
    if (flatMatch) {
      violations.push({
        filePath: flatMatch[1].trim(),
        line: parseInt(flatMatch[2], 10),
        column: parseInt(flatMatch[3], 10),
        severity: flatMatch[5].toLowerCase() as 'error' | 'warning',
        message: flatMatch[4].trim(),
        rule: flatMatch[6].trim(),
      });
      continue;
    }
  }

  return violations;
}

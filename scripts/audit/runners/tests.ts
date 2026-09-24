/**
 * Test Runner — executes `npm run test -- --run` and records results.
 * Parses vitest output for passing/failing/skipped counts.
 * Emits GapItems for failing property tests with fast-check counterexamples.
 * Requirements: 2.5, 2.6
 */

import { execFile } from 'node:child_process';
import type { GapItem, TestResult } from '../types';

export interface TestRunnerResult {
  testResult: TestResult;
  gaps: GapItem[];
}

interface FailingPropertyTest {
  testName: string;
  filePath: string;
  failingExample: string;
}

const TEST_TIMEOUT_MS = 300_000; // 300 seconds

/**
 * Runs `npm run test -- --run` in the given workspace root directory.
 * Records exit code, passing/failing/skipped counts.
 * Emits one GapItem per failing property test with severity "major" and area "failing-property-test".
 */
export async function runTests(workspaceRoot: string): Promise<TestRunnerResult> {
  const gaps: GapItem[] = [];

  let stdout = '';
  let stderr = '';
  let exitCode: number;

  try {
    const result = await executeCommand(workspaceRoot);
    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = result.exitCode;
  } catch {
    // Command not found or timeout
    return {
      testResult: {
        exit_code: -1,
        passing: 0,
        failing: 0,
        skipped: 0,
      },
      gaps: [],
    };
  }

  const output = stdout + stderr;
  const counts = parseVitestCounts(output);

  const testResult: TestResult = {
    exit_code: exitCode,
    passing: counts.passing,
    failing: counts.failing,
    skipped: counts.skipped,
  };

  // Parse failing property tests and emit GapItems
  if (counts.failing > 0) {
    const failingPropertyTests = parseFailingPropertyTests(output);
    for (const test of failingPropertyTests) {
      gaps.push({
        id: '', // Will be assigned by generateGapIds
        area: 'failing-property-test',
        severity: 'major',
        description: `Property test failed: ${test.testName}. Failing example: ${test.failingExample}`,
        evidence_paths: [test.filePath],
        requirement_refs: ['project-completion-audit/2.5', 'project-completion-audit/2.6'],
        proposed_action: `Fix the failing property test "${test.testName}" — counterexample: ${test.failingExample}`,
      });
    }
  }

  return { testResult, gaps };
}

/**
 * Executes `npm run test -- --run` with a 300-second timeout.
 */
function executeCommand(cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : '/bin/sh';
    const shellArgs = isWindows
      ? ['/c', 'npm run test -- --run']
      : ['-c', 'npm run test -- --run'];

    const child = execFile(shell, shellArgs, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: TEST_TIMEOUT_MS,
    }, (error, stdout, stderr) => {
      if (error) {
        // Timeout
        if (error.killed || error.signal === 'SIGTERM') {
          reject(new Error('TIMEOUT: Test command timed out after 300s'));
          return;
        }
        // Command not found
        if ('code' in error && error.code === 'ENOENT') {
          reject(new Error('ENOENT: Test command not found'));
          return;
        }
        // Non-zero exit (test failures) — expected
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
      reject(new Error('TIMEOUT: Test command timed out after 300s'));
    }, TEST_TIMEOUT_MS + 5000);

    child.on('close', () => clearTimeout(timer));
  });
}

/**
 * Parses vitest output to extract passing, failing, and skipped test counts.
 *
 * Vitest summary line formats:
 *   Tests  12 passed | 3 failed | 2 skipped (17)
 *   Tests  5 passed (5)
 *   Tests  2 failed | 1 skipped (3)
 */
export function parseVitestCounts(output: string): { passing: number; failing: number; skipped: number } {
  let passing = 0;
  let failing = 0;
  let skipped = 0;

  const lines = output.split('\n');

  for (const line of lines) {
    // Match the vitest summary line: "Tests  N passed | N failed | N skipped (total)"
    // or "Test Files  N passed | N failed (total)"
    const testsLineMatch = line.match(/^\s*Tests?\s+(.+?)(?:\s*\(\d+\))?\s*$/i);
    if (testsLineMatch) {
      const content = testsLineMatch[1];

      const passedMatch = content.match(/(\d+)\s+passed/i);
      const failedMatch = content.match(/(\d+)\s+failed/i);
      const skippedMatch = content.match(/(\d+)\s+skipped/i);
      const todoMatch = content.match(/(\d+)\s+todo/i);

      if (passedMatch) passing = parseInt(passedMatch[1], 10);
      if (failedMatch) failing = parseInt(failedMatch[1], 10);
      if (skippedMatch) skipped = parseInt(skippedMatch[1], 10);
      if (todoMatch) skipped += parseInt(todoMatch[1], 10);
    }
  }

  return { passing, failing, skipped };
}

/**
 * Parses vitest output to find failing property tests (tests under tests/property/).
 * Extracts the test name and the fast-check counterexample.
 *
 * fast-check output format:
 *   Property failed after N tests
 *   { seed: ..., path: "...", endOnFailure: true }
 *   Counterexample: [...]
 *   Shrunk N time(s)
 *
 * Vitest failure format:
 *   FAIL  tests/property/some-test.test.ts > Suite > test name
 *   AssertionError: Property failed after N tests
 *   Counterexample: [value]
 */
export function parseFailingPropertyTests(output: string): FailingPropertyTest[] {
  const results: FailingPropertyTest[] = [];
  const lines = output.split('\n');

  let currentTestName = '';
  let currentFilePath = '';
  let inFailBlock = false;
  let counterexample = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect failing test block from vitest output
    // Format: "FAIL  tests/property/file.test.ts > Suite > test name"
    // or "× test name" preceded by file path context
    const failMatch = line.match(/FAIL\s+(tests\/property\/[^\s>]+)/i);
    if (failMatch) {
      currentFilePath = failMatch[1].replace(/\\/g, '/');
      // Extract test name from the rest of the line
      const nameMatch = line.match(/>\s*(.+?)\s*$/);
      if (nameMatch) {
        currentTestName = nameMatch[1].trim();
      }
      inFailBlock = true;
      counterexample = '';
      continue;
    }

    // Also detect file path from vitest's "❯ tests/property/..." format
    const filePathMatch = line.match(/[❯›]\s+(tests\/property\/[^\s]+)/);
    if (filePathMatch) {
      currentFilePath = filePathMatch[1].replace(/\\/g, '/');
    }

    // Detect test name from "× test name" or "✗ test name" format
    const testNameMatch = line.match(/[×✗✘]\s+(.+?)$/);
    if (testNameMatch && currentFilePath.includes('tests/property/')) {
      currentTestName = testNameMatch[1].trim();
      inFailBlock = true;
      counterexample = '';
      continue;
    }

    // Look for Counterexample line from fast-check
    const counterexampleMatch = line.match(/Counterexample:\s*(.+)/i);
    if (counterexampleMatch && inFailBlock) {
      counterexample = counterexampleMatch[1].trim();

      // Collect multi-line counterexamples (arrays/objects spanning multiple lines)
      let depth = countBracketDepth(counterexample);
      let j = i + 1;
      while (depth > 0 && j < lines.length && j < i + 20) {
        const nextLine = lines[j].trim();
        if (nextLine === '' || nextLine.startsWith('Shrunk') || nextLine.startsWith('Got') || nextLine.startsWith('Expected')) {
          break;
        }
        counterexample += ' ' + nextLine;
        depth = countBracketDepth(counterexample);
        j++;
      }

      // Emit the result if we have enough info
      if (currentTestName && currentFilePath) {
        results.push({
          testName: currentTestName,
          filePath: currentFilePath,
          failingExample: counterexample,
        });
      }
      inFailBlock = false;
      continue;
    }

    // Also detect "Property failed after N tests" as a signal
    const propertyFailedMatch = line.match(/Property failed after \d+ tests?/i);
    if (propertyFailedMatch && currentFilePath.includes('tests/property/')) {
      inFailBlock = true;
      continue;
    }

    // Reset on empty lines or new test sections (but only if we already captured a result)
    if (line.trim() === '' && inFailBlock && counterexample) {
      inFailBlock = false;
    }
  }

  return results;
}

/**
 * Counts the net bracket depth (open - close) for [ ] and { } in a string.
 * Returns 0 when brackets are balanced.
 */
function countBracketDepth(str: string): number {
  let depth = 0;
  for (const ch of str) {
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
  }
  return depth;
}

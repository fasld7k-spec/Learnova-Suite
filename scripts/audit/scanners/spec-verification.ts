/**
 * Prior Spec Verification Scanner
 *
 * Parses Prior_Spec `tasks.md` files to extract checked tasks and property-test tasks,
 * maps them to referenced file paths, and verifies those files exist.
 * Also verifies property test files contain valid test markers.
 * Builds a `requirements_without_tests` array for requirements with no corresponding test.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.7
 */

import type { GapItem, Scanner, ScannerContext } from '../types';

/** Prior spec directories to scan */
const PRIOR_SPEC_DIRS = [
  '.kiro/specs/learnova-platform-development-plan',
  '.kiro/specs/theme-system-development',
] as const;

/**
 * Extracts all checked task lines (`- [x]`) from a markdown string.
 * Returns the full text of each checked task line (trimmed).
 *
 * Exported for property testing.
 */
export function extractCheckedTasks(markdown: string): string[] {
  const lines = markdown.split('\n');
  const results: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^-\s*\[x\]/i.test(trimmed)) {
      results.push(trimmed);
    }
  }

  return results;
}

/**
 * Extracts all property-test task lines (lines containing `Property N` pattern)
 * from a markdown string. Returns the full text of each matching line (trimmed).
 *
 * Exported for property testing.
 */
export function extractPropertyTestTasks(markdown: string): string[] {
  const lines = markdown.split('\n');
  const results: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "Property" followed by a space and a number (e.g., "Property 1", "Property 12")
    if (/Property\s+\d+/i.test(trimmed)) {
      results.push(trimmed);
    }
  }

  return results;
}

/**
 * Extracts file paths from a task description string.
 * Looks for:
 * 1. Backtick-quoted paths (e.g., `lib/auth.ts`)
 * 2. Paths after keywords: Create, Update, Implement
 *
 * Returns an array of unique file paths found.
 *
 * Exported for property testing.
 */
export function extractFilePaths(taskDescription: string): string[] {
  const paths = new Set<string>();

  // Pattern 1: Backtick-quoted paths that look like file paths
  // Match content in backticks that contains a slash or ends with a file extension
  const backtickRegex = /`([^`]+)`/g;
  let match: RegExpExecArray | null;

  while ((match = backtickRegex.exec(taskDescription)) !== null) {
    const candidate = match[1].trim();
    if (isLikelyFilePath(candidate)) {
      paths.add(candidate);
    }
  }

  // Pattern 2: Paths after Create/Update/Implement keywords
  // e.g., "Create `lib/payment-gateways/base.ts`" or "Create lib/payment-gateways/base.ts"
  const keywordRegex = /(?:Create|Update|Implement)\s+`?([^\s`,:;]+\.[a-zA-Z]{1,10})`?/gi;

  while ((match = keywordRegex.exec(taskDescription)) !== null) {
    const candidate = match[1].trim();
    if (isLikelyFilePath(candidate)) {
      paths.add(candidate);
    }
  }

  return Array.from(paths);
}

/**
 * Determines if a string looks like a file path.
 * A likely file path contains a `/` or `\` separator and has a common file extension.
 */
function isLikelyFilePath(candidate: string): boolean {
  // Must contain a path separator (forward or back slash)
  if (!candidate.includes('/') && !candidate.includes('\\')) {
    return false;
  }

  // Must have a file extension
  if (!/\.[a-zA-Z]{1,10}$/.test(candidate)) {
    return false;
  }

  // Exclude things that are clearly not file paths
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return false;
  }

  // Exclude domain names (e.g., "Bunny.net", "example.com")
  if (/^[A-Za-z0-9-]+\.[a-z]{2,6}$/.test(candidate)) {
    return false;
  }

  // Exclude very short candidates that are likely code snippets
  if (candidate.length < 3) {
    return false;
  }

  return true;
}

/**
 * Checks if a file content string is a valid property test file.
 * A valid property test file must contain at least one `fc.assert` or `it(` marker.
 *
 * Exported for property testing.
 */
export function isValidPropertyTestFile(content: string): boolean {
  return content.includes('fc.assert') || content.includes('it(');
}

/**
 * Extracts requirement references from task lines.
 * Looks for patterns like `_Requirements: X.Y, X.Z_` or `Requirements: X.Y`
 */
function extractRequirementRefs(taskLines: string[], specName: string): string[] {
  const refs: string[] = [];
  const reqRegex = /Requirements?:\s*([\d.,\s]+)/gi;

  for (const line of taskLines) {
    let match: RegExpExecArray | null;
    while ((match = reqRegex.exec(line)) !== null) {
      const numbers = match[1].split(',').map(s => s.trim()).filter(s => /^\d+(\.\d+)?$/.test(s));
      for (const num of numbers) {
        refs.push(`${specName}/${num}`);
      }
    }
  }

  return refs;
}

/**
 * Extracts all requirement identifiers from a Prior_Spec tasks.md file.
 * Returns an array of requirement refs like ["learnova-platform-development-plan/1.1", ...]
 */
function extractAllRequirements(markdown: string, specName: string): string[] {
  const refs = new Set<string>();
  const reqRegex = /Requirements?:\s*([\d.,\s]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = reqRegex.exec(markdown)) !== null) {
    const numbers = match[1].split(',').map(s => s.trim()).filter(s => /^\d+(\.\d+)?$/.test(s));
    for (const num of numbers) {
      refs.add(`${specName}/${num}`);
    }
  }

  return Array.from(refs).sort();
}

/**
 * Extracts requirement refs that are validated by tests.
 * Looks for "Validates: Requirements X.Y" patterns in the markdown.
 */
function extractTestedRequirements(markdown: string, specName: string): string[] {
  const refs = new Set<string>();
  const validatesRegex = /Validates:\s*Requirements?\s*([\d.,\s]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = validatesRegex.exec(markdown)) !== null) {
    const numbers = match[1].split(',').map(s => s.trim()).filter(s => /^\d+(\.\d+)?$/.test(s));
    for (const num of numbers) {
      refs.add(`${specName}/${num}`);
    }
  }

  return Array.from(refs);
}

/**
 * Determines if a path references a property test file.
 * Property test files are expected under `tests/property/`.
 */
function isPropertyTestPath(filePath: string): boolean {
  return filePath.startsWith('tests/property/') && filePath.endsWith('.test.ts');
}

/**
 * Extracts property test file paths from property test task lines.
 * Looks for "Test file:" patterns or backtick-quoted paths under tests/property/.
 */
function extractPropertyTestFilePaths(taskLines: string[]): string[] {
  const paths: string[] = [];
  const testFileRegex = /Test file:\s*`?([^`\s]+)`?/i;

  for (const line of taskLines) {
    const match = testFileRegex.exec(line);
    if (match) {
      paths.push(match[1].trim());
    }
  }

  // Also look for backtick-quoted paths under tests/property/
  for (const line of taskLines) {
    const backtickRegex = /`(tests\/property\/[^`]+)`/g;
    let match2: RegExpExecArray | null;
    while ((match2 = backtickRegex.exec(line)) !== null) {
      const candidate = match2[1].trim();
      if (!paths.includes(candidate)) {
        paths.push(candidate);
      }
    }
  }

  return paths;
}

/**
 * Prior Spec Verification Scanner implementation.
 */
export const specVerificationScanner: Scanner = {
  name: 'spec-verification',

  async scan(ctx: ScannerContext): Promise<GapItem[]> {
    const gaps: GapItem[] = [];
    const allRequirements: string[] = [];
    const testedRequirements = new Set<string>();

    for (const specDir of PRIOR_SPEC_DIRS) {
      const tasksPath = `${specDir}/tasks.md`;
      const specName = specDir.split('/').pop()!;

      // Check if tasks.md exists
      if (!(await ctx.fileExists(tasksPath))) {
        continue;
      }

      const markdown = await ctx.readFile(tasksPath);

      // Extract all requirements from this spec
      const specRequirements = extractAllRequirements(markdown, specName);
      allRequirements.push(...specRequirements);

      // Extract tested requirements
      const specTestedReqs = extractTestedRequirements(markdown, specName);
      for (const req of specTestedReqs) {
        testedRequirements.add(req);
      }

      // Extract checked tasks
      const checkedTasks = extractCheckedTasks(markdown);

      // Process each checked task for file path references
      for (const task of checkedTasks) {
        const filePaths = extractFilePaths(task);

        for (const filePath of filePaths) {
          // Skip paths that are clearly not source files
          if (filePath.startsWith('.kiro/') || filePath.startsWith('node_modules/')) {
            continue;
          }

          // Check if the referenced file exists
          const exists = await ctx.fileExists(filePath);
          if (!exists) {
            gaps.push({
              id: '', // Will be assigned by generateGapIds
              area: 'spec-drift',
              severity: 'blocker',
              description: `Checked task references file "${filePath}" which does not exist in the source codebase`,
              evidence_paths: [filePath],
              requirement_refs: [`${specName}/2.3`],
              proposed_action: `Create the missing file "${filePath}" or update the spec task to reflect the actual file location`,
            });
          }
        }
      }

      // Extract property test tasks and verify test files
      const propertyTestTasks = extractPropertyTestTasks(markdown);
      const lines = markdown.split('\n');

      // For each property test task, find associated test file paths
      for (const task of propertyTestTasks) {
        // Find the line index of this task and gather context lines
        const taskLineIdx = lines.findIndex(l => l.trim() === task);
        if (taskLineIdx === -1) continue;

        // Gather context: the task line and a few lines after it
        const contextLines: string[] = [];
        for (let i = taskLineIdx; i < Math.min(taskLineIdx + 5, lines.length); i++) {
          contextLines.push(lines[i]);
        }

        const testFilePaths = extractPropertyTestFilePaths(contextLines);

        for (const testPath of testFilePaths) {
          if (!isPropertyTestPath(testPath)) continue;

          const testExists = await ctx.fileExists(testPath);
          if (!testExists) {
            gaps.push({
              id: '',
              area: 'missing-property-test',
              severity: 'major',
              description: `Property test file "${testPath}" referenced in spec does not exist`,
              evidence_paths: [testPath],
              requirement_refs: [`${specName}/2.4`],
              proposed_action: `Create the property test file "${testPath}" with appropriate fc.assert or it( test blocks`,
            });
          } else {
            // File exists — verify it contains valid test markers
            const content = await ctx.readFile(testPath);
            if (!isValidPropertyTestFile(content)) {
              gaps.push({
                id: '',
                area: 'missing-property-test',
                severity: 'major',
                description: `Property test file "${testPath}" exists but does not contain fc.assert or it( markers`,
                evidence_paths: [testPath],
                requirement_refs: [`${specName}/2.4`],
                proposed_action: `Add property-based test assertions using fc.assert or it( blocks to "${testPath}"`,
              });
            }
          }
        }
      }
    }

    // Also check for test files that reference requirements via glob
    // Look for test files that contain "Validates: Requirements" patterns
    const testFiles = await ctx.glob('tests/**/*.test.ts');
    for (const testFile of testFiles) {
      try {
        const content = await ctx.readFile(testFile);
        const validatesRegex = /Validates:\s*Requirements?\s*([\d.,\s]+)/gi;
        let match: RegExpExecArray | null;
        while ((match = validatesRegex.exec(content)) !== null) {
          const numbers = match[1].split(',').map(s => s.trim()).filter(s => /^\d+(\.\d+)?$/.test(s));
          for (const num of numbers) {
            // Try to match to known specs
            for (const specDir of PRIOR_SPEC_DIRS) {
              const specName = specDir.split('/').pop()!;
              testedRequirements.add(`${specName}/${num}`);
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return gaps;
  },
};

/**
 * Pure function: computes the set of uncovered requirements.
 * Given all requirement identifiers and the set of tested identifiers,
 * returns exactly those identifiers that are in `allRequirements` but not in `testedRequirements`.
 * Result is sorted and deduplicated.
 *
 * Exported for property testing.
 */
export function computeUncoveredRequirements(
  allRequirements: string[],
  testedRequirements: string[],
): string[] {
  const testedSet = new Set(testedRequirements);
  const uncoveredSet = new Set<string>();

  for (const req of allRequirements) {
    if (!testedSet.has(req)) {
      uncoveredSet.add(req);
    }
  }

  return Array.from(uncoveredSet).sort();
}

/**
 * Builds the `requirements_without_tests` array.
 * Returns requirement identifiers from Prior_Specs that have no corresponding test.
 *
 * Exported for use by the report generator and for property testing.
 */
export async function getRequirementsWithoutTests(ctx: ScannerContext): Promise<string[]> {
  const allRequirements: string[] = [];
  const testedRequirements = new Set<string>();

  for (const specDir of PRIOR_SPEC_DIRS) {
    const tasksPath = `${specDir}/tasks.md`;
    const specName = specDir.split('/').pop()!;

    if (!(await ctx.fileExists(tasksPath))) {
      continue;
    }

    const markdown = await ctx.readFile(tasksPath);

    // Extract all requirements from this spec
    const specRequirements = extractAllRequirements(markdown, specName);
    allRequirements.push(...specRequirements);

    // Extract tested requirements from spec (Validates: patterns)
    const specTestedReqs = extractTestedRequirements(markdown, specName);
    for (const req of specTestedReqs) {
      testedRequirements.add(req);
    }
  }

  // Also check test files for requirement references
  const testFiles = await ctx.glob('tests/**/*.test.ts');
  for (const testFile of testFiles) {
    try {
      const content = await ctx.readFile(testFile);
      const validatesRegex = /Validates:\s*Requirements?\s*([\d.,\s]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = validatesRegex.exec(content)) !== null) {
        const numbers = match[1].split(',').map(s => s.trim()).filter(s => /^\d+(\.\d+)?$/.test(s));
        for (const num of numbers) {
          for (const specDir of PRIOR_SPEC_DIRS) {
            const specName = specDir.split('/').pop()!;
            testedRequirements.add(`${specName}/${num}`);
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Return requirements that have no corresponding test using the pure function
  return computeUncoveredRequirements(allRequirements, Array.from(testedRequirements));
}

export default specVerificationScanner;

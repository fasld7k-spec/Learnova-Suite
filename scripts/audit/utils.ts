/**
 * Utility functions for the Project Completion Audit system.
 * Provides path normalization, git SHA resolution, and file system helpers.
 * Requirements: 1.5, 1.6, 10.4
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// --- Path Normalization ---

/**
 * Converts an absolute path to a workspace-relative path using forward slashes.
 * Returns `null` if the path is outside the workspace (Requirement 10.4).
 */
export function normalizePath(absolutePath: string, workspaceRoot: string): string | null {
  const relative = path.relative(workspaceRoot, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.replace(/\\/g, '/');
}

// --- Git SHA Resolution ---

/**
 * Resolves the current git commit SHA.
 * Falls back to "unknown" if git is unavailable or not in a repo (Requirement 1.6).
 */
export async function getGitSha(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

// --- File System Helpers ---

/**
 * Reads a file as a UTF-8 string.
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

/**
 * Checks if a file or directory exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists directory contents at a given depth (default 1).
 * Returns relative paths from the given directory using forward slashes.
 * Depth 1 returns immediate children; depth > 1 recurses into subdirectories.
 */
export async function listDir(dirPath: string, depth: number = 1): Promise<string[]> {
  const results: string[] = [];
  await listDirRecursive(dirPath, dirPath, depth, results);
  return results.sort();
}

async function listDirRecursive(
  basePath: string,
  currentPath: string,
  remainingDepth: number,
  results: string[]
): Promise<void> {
  if (remainingDepth <= 0) return;

  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
    results.push(relativePath);

    if (entry.isDirectory() && remainingDepth > 1) {
      await listDirRecursive(basePath, fullPath, remainingDepth - 1, results);
    }
  }
}

/**
 * Finds files matching a glob pattern relative to the workspace root.
 * Uses a simple recursive file walk with pattern matching.
 * Supports `*` (any segment chars) and `**` (any path depth) glob patterns.
 */
export async function glob(pattern: string, workspaceRoot: string): Promise<string[]> {
  const results: string[] = [];
  const regex = globToRegex(pattern);

  await walkDir(workspaceRoot, workspaceRoot, results, regex);
  return results.sort();
}

/**
 * Converts a glob pattern to a RegExp.
 * Supports:
 * - `*` matches any characters except path separators
 * - `**` matches any path depth (zero or more directories)
 * - `?` matches a single character
 */
function globToRegex(pattern: string): RegExp {
  // Normalize to forward slashes
  const normalized = pattern.replace(/\\/g, '/');

  let regexStr = '^';
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];

    if (char === '*') {
      if (normalized[i + 1] === '*') {
        // ** matches any path depth
        if (normalized[i + 2] === '/') {
          regexStr += '(?:.+/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else {
        // * matches anything except /
        regexStr += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      regexStr += '[^/]';
      i++;
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else if (char === '/') {
      regexStr += '/';
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }

  regexStr += '$';
  return new RegExp(regexStr);
}

async function walkDir(
  basePath: string,
  currentPath: string,
  results: string[],
  pattern: RegExp
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    // Skip node_modules and .git directories for performance
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
      continue;
    }

    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      await walkDir(basePath, fullPath, results, pattern);
    } else if (pattern.test(relativePath)) {
      results.push(relativePath);
    }
  }
}

// --- Context Builder ---

/**
 * Builds a ScannerContext from a workspace root path.
 * This wires up the file system helpers with the workspace root.
 */
export function buildScannerContext(workspaceRoot: string) {
  return {
    workspaceRoot,
    readFile: (filePath: string) => readFile(path.resolve(workspaceRoot, filePath)),
    fileExists: (filePath: string) => fileExists(path.resolve(workspaceRoot, filePath)),
    listDir: (dirPath: string, depth?: number) =>
      listDir(path.resolve(workspaceRoot, dirPath), depth),
    glob: (pattern: string) => glob(pattern, workspaceRoot),
  };
}

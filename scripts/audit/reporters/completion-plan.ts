/**
 * Completion Plan Generator for the Project Completion Audit system.
 * Produces `completion-plan.md` from Gap_Items grouped by area and ordered by severity weight.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

import type { GapItem, Severity } from '../types';

// --- Severity Weights ---

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  blocker: 1000,
  major: 100,
  minor: 1,
};

// --- Exported Functions ---

/**
 * Renders the full completion plan markdown from gap items and production readiness flag.
 *
 * - Zero-gap case: returns single-line "No outstanding items" message (Req 8.7)
 * - production_ready true with remaining gaps: renders standard checklist (Req 8.8)
 * - Groups items by area, orders groups by descending severity weight (Req 8.2)
 * - Renders each item as checklist with Acceptance line (Req 8.3)
 * - Includes evidence_paths (Req 8.4)
 * - Begins with Blockers section if any blockers exist (Req 8.5)
 * - Includes Verification section with re-run commands (Req 8.6)
 */
export function renderCompletionPlan(gaps: GapItem[], productionReady: boolean): string {
  // Req 8.7: zero-gap case
  if (gaps.length === 0) {
    return 'No outstanding items. Project meets the audit criteria.\n';
  }

  // Req 8.8: production_ready true with remaining gaps — render standard checklist
  // (ignore production_ready flag for output formatting)

  const lines: string[] = [];
  lines.push('# Completion Plan');
  lines.push('');

  const blockers = gaps.filter(g => g.severity === 'blocker');
  const nonBlockers = gaps.filter(g => g.severity !== 'blocker');

  // Req 8.5: Blockers section first if any blockers exist
  if (blockers.length > 0) {
    lines.push('## Blockers (must close first)');
    lines.push('');
    const blockerGroups = groupByArea(blockers);
    const sortedBlockerGroups = sortGroupsBySeverityWeight(blockerGroups);
    for (const group of sortedBlockerGroups) {
      renderGroup(group, lines);
    }
  }

  // Req 8.2: Group remaining items by area, order by descending severity weight
  if (nonBlockers.length > 0) {
    lines.push('## Remaining Items');
    lines.push('');
    const remainingGroups = groupByArea(nonBlockers);
    const sortedRemainingGroups = sortGroupsBySeverityWeight(remainingGroups);
    for (const group of sortedRemainingGroups) {
      renderGroup(group, lines);
    }
  }

  // Req 8.6: Verification section
  lines.push('## Verification');
  lines.push('');
  lines.push('Re-run the following commands to verify all items are resolved:');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run lint');
  lines.push('npx tsc --noEmit');
  lines.push('npm run test -- --run');
  lines.push('npm run build');
  lines.push('npm run audit');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

// --- Internal Helpers ---

interface AreaGroup {
  area: string;
  items: GapItem[];
  weight: number;
}

/**
 * Groups gap items by their `area` field.
 */
function groupByArea(gaps: GapItem[]): AreaGroup[] {
  const map = new Map<string, GapItem[]>();

  for (const gap of gaps) {
    const existing = map.get(gap.area);
    if (existing) {
      existing.push(gap);
    } else {
      map.set(gap.area, [gap]);
    }
  }

  const groups: AreaGroup[] = [];
  map.forEach((items, area) => {
    groups.push({
      area,
      items,
      weight: computeGroupWeight(items),
    });
  });

  return groups;
}

/**
 * Computes the severity weight for a group of items.
 * Group sort key = sum of (blockerCount × 1000 + majorCount × 100 + minorCount × 1) descending.
 */
function computeGroupWeight(items: GapItem[]): number {
  let weight = 0;
  for (const item of items) {
    weight += SEVERITY_WEIGHTS[item.severity];
  }
  return weight;
}

/**
 * Sorts groups by descending severity weight.
 * For equal weights, sort alphabetically by area for determinism.
 */
function sortGroupsBySeverityWeight(groups: AreaGroup[]): AreaGroup[] {
  return [...groups].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.area.localeCompare(b.area);
  });
}

/**
 * Renders a single area group into the output lines.
 * Req 8.3: Each item as `- [ ] {area}: {description} (severity: {severity})`
 * with indented `Acceptance:` line.
 * Req 8.4: Include evidence_paths for each item.
 */
function renderGroup(group: AreaGroup, lines: string[]): void {
  lines.push(`### ${group.area}`);
  lines.push('');

  for (const item of group.items) {
    // Req 8.3: Checklist line
    lines.push(`- [ ] ${item.area}: ${item.description} (severity: ${item.severity})`);

    // Req 8.3: Indented Acceptance line
    lines.push(`  Acceptance: ${item.proposed_action}`);

    // Req 8.4: Evidence paths
    if (item.evidence_paths.length > 0) {
      lines.push(`  Evidence: ${item.evidence_paths.join(', ')}`);
    }
  }

  lines.push('');
}

import { fromJsonArray, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export type RoadmapStatus = 'Operational' | 'Configurable' | 'Planned' | 'Paused';

export type RoadmapItem = {
  id: string;
  title: string;
  status: RoadmapStatus;
  description: string;
  href: string;
  sortOrder: number;
  active: boolean;
  updatedAt: string;
};

export const roadmapStatuses: RoadmapStatus[] = ['Operational', 'Configurable', 'Planned', 'Paused'];

const defaultRoadmapItems: RoadmapItem[] = [
  {
    id: 'mobile-readiness',
    title: 'Mobile readiness',
    status: 'Configurable',
    description: 'PWA, store links, API surfaces, and admin mobile settings are included for mobile rollout.',
    href: '/admin/mobile-app',
    sortOrder: 10,
    active: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'analytics-reports',
    title: 'Analytics and reports',
    status: 'Operational',
    description: 'Admin and instructor reports, course views, page views, exports, and metrics pages are available.',
    href: '/admin/reports',
    sortOrder: 20,
    active: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'multi-tenant-academies',
    title: 'Multi-tenant academies',
    status: 'Configurable',
    description: 'Tenant, domain, and tenant course modules are present for expansion and customization.',
    href: '/admin/tenants',
    sortOrder: 30,
    active: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'white-label-domains',
    title: 'White-label domains',
    status: 'Configurable',
    description: 'White-label settings, logos, support details, and domain screens are included.',
    href: '/admin/white-label',
    sortOrder: 40,
    active: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'ai-course-tools',
    title: 'AI course tools',
    status: 'Operational',
    description: 'Admin-managed AI provider settings, testing, and instructor course idea generation are included.',
    href: '/admin/settings',
    sortOrder: 50,
    active: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'subscriptions',
    title: 'Subscriptions',
    status: 'Operational',
    description: 'Membership plans, student subscriptions, and admin approval queues are included.',
    href: '/admin/subscription-plans',
    sortOrder: 60,
    active: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
];

function slugify(raw: string) {
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `roadmap-${Date.now()}`;
}

function normalizeStatus(value: unknown): RoadmapStatus {
  return roadmapStatuses.includes(value as RoadmapStatus) ? value as RoadmapStatus : 'Planned';
}

function normalizeItem(item: Partial<RoadmapItem>, index: number): RoadmapItem {
  const title = String(item.title || 'Untitled roadmap item').trim();
  return {
    id: slugify(String(item.id || title)),
    title,
    status: normalizeStatus(item.status),
    description: String(item.description || '').trim(),
    href: String(item.href || '/admin/roadmap').trim(),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : (index + 1) * 10,
    active: item.active !== false,
    updatedAt: String(item.updatedAt || new Date().toISOString()),
  };
}

export async function getRoadmapItems() {
  const row = await prisma.setting.findUnique({ where: { key: 'admin_roadmap' } }).catch(() => null);
  const saved = fromJsonArray<Partial<RoadmapItem>>(row?.value);
  const items = (saved.length ? saved : defaultRoadmapItems)
    .map(normalizeItem)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  return items;
}

export async function saveRoadmapItems(items: RoadmapItem[]) {
  await prisma.setting.upsert({
    where: { key: 'admin_roadmap' },
    update: { value: toJson(items) },
    create: { key: 'admin_roadmap', value: toJson(items) },
  });
}

export function createRoadmapItem(input: { title: string; status: string; description: string; href: string; sortOrder: number; active: boolean }) {
  return normalizeItem({
    id: slugify(input.title),
    title: input.title,
    status: normalizeStatus(input.status),
    description: input.description,
    href: input.href,
    sortOrder: input.sortOrder,
    active: input.active,
    updatedAt: new Date().toISOString(),
  }, 0);
}

export function updateRoadmapItem(current: RoadmapItem, input: Partial<RoadmapItem>) {
  return normalizeItem({
    ...current,
    ...input,
    id: current.id,
    updatedAt: new Date().toISOString(),
  }, 0);
}

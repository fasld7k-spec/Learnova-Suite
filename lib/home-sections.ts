import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export type HomeSectionKey =
  | 'heroSlider'
  | 'featuredCourses'
  | 'categories'
  | 'instructors'
  | 'reviews'
  | 'subscriptions'
  | 'blog';

export type HomeSectionConfig = {
  key: HomeSectionKey;
  title: string;
  description: string;
  href: string;
  enabled: boolean;
  sortOrder: number;
};

export const defaultHomeSections: HomeSectionConfig[] = [
  {
    key: 'heroSlider',
    title: 'Hero and slider',
    description: 'Controls hero slides, CTA labels, images, and ordering for slider-based home areas.',
    href: '/admin/sliders',
    enabled: true,
    sortOrder: 10,
  },
  {
    key: 'featuredCourses',
    title: 'Featured catalog',
    description: 'Published courses feed the marketplace rows, featured sections, search pages, and category pages.',
    href: '/admin/courses',
    enabled: true,
    sortOrder: 20,
  },
  {
    key: 'categories',
    title: 'Categories',
    description: 'Category chips, catalog filters, and home category rails use these admin-managed records.',
    href: '/admin/categories',
    enabled: true,
    sortOrder: 30,
  },
  {
    key: 'instructors',
    title: 'Instructor proof',
    description: 'Approved instructor profiles power trust blocks, public instructor pages, and booking entry points.',
    href: '/admin/instructors',
    enabled: true,
    sortOrder: 40,
  },
  {
    key: 'reviews',
    title: 'Reviews and social proof',
    description: 'Student reviews feed trust blocks, testimonials, and course proof sections.',
    href: '/admin/reviews',
    enabled: true,
    sortOrder: 50,
  },
  {
    key: 'subscriptions',
    title: 'Subscriptions',
    description: 'Membership CTA sections use active plans from the subscription plan manager.',
    href: '/admin/subscription-plans',
    enabled: true,
    sortOrder: 60,
  },
  {
    key: 'blog',
    title: 'Blog and updates',
    description: 'Editorial sections can point buyers to published blog posts, changelog content, and knowledge resources.',
    href: '/admin/blog',
    enabled: true,
    sortOrder: 70,
  },
];

type StoredHomeSection = Partial<Omit<HomeSectionConfig, 'key' | 'href' | 'description'>> & { key?: string };

export async function getHomeSectionSettings(): Promise<HomeSectionConfig[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'home_sections' } }).catch(() => null);
  const stored = fromJsonObject<{ sections?: StoredHomeSection[] }>(row?.value);
  const byKey = new Map((stored.sections || []).map((section) => [section.key, section]));

  return defaultHomeSections
    .map((section) => {
      const incoming = byKey.get(section.key);
      return {
        ...section,
        title: String(incoming?.title || section.title).trim() || section.title,
        enabled: incoming?.enabled === undefined ? section.enabled : Boolean(incoming.enabled),
        sortOrder: Number.isFinite(Number(incoming?.sortOrder)) ? Number(incoming?.sortOrder) : section.sortOrder,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export async function saveHomeSectionSettings(sections: HomeSectionConfig[]) {
  const normalized = defaultHomeSections.map((section) => {
    const incoming = sections.find((item) => item.key === section.key);
    return {
      key: section.key,
      title: String(incoming?.title || section.title).trim() || section.title,
      enabled: Boolean(incoming?.enabled),
      sortOrder: Number.isFinite(Number(incoming?.sortOrder)) ? Number(incoming?.sortOrder) : section.sortOrder,
    };
  });

  await prisma.setting.upsert({
    where: { key: 'home_sections' },
    update: { value: toJson({ sections: normalized }) },
    create: { key: 'home_sections', value: toJson({ sections: normalized }) },
  });
}

export function homeSectionEnabled(sections: HomeSectionConfig[], key: HomeSectionKey) {
  return sections.find((section) => section.key === key)?.enabled ?? true;
}

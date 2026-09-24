import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

function savedSearchHref(row: { query: string; filters: unknown }, categories: { id: string; slug: string }[]) {
  const filters = fromJsonObject<Record<string, unknown>>(row.filters);
  const params = new URLSearchParams();
  if (row.query) params.set('q', row.query);

  const categoryValue = String(filters.category || '').trim();
  const category = categories.find((item) => item.id === categoryValue || item.slug === categoryValue);
  if (category) params.set('category', category.id);

  const level = String(filters.level || '').trim();
  if (level) params.set('level', level);

  const price = String(filters.price || '').trim();
  if (price === 'free') {
    params.set('minPrice', '0');
    params.set('maxPrice', '0');
  } else if (price === 'paid') {
    params.set('minPrice', '1');
  }

  const query = params.toString();
  return query ? `/courses?${query}` : '/courses';
}

export default async function SavedSearches() {
  const user = await requireUser(['STUDENT']);
  const [rows, categories, settings] = await Promise.all([
    prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.category.findMany({ orderBy: { nameEn: 'asc' } }),
    getSiteSettings()
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);

  return (
    <DashboardShell role="student" title="Saved Searches">
      <form className="card mb-6 grid gap-3" action="/api/student/saved-searches" method="post">
        <CsrfInput />
        <input className="input" name="query" placeholder={t('Search query')} required />
        <div className="grid gap-3 md:grid-cols-3">
          <select className="input" name="category">
            <option value="">{t('Any category')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameEn}
              </option>
            ))}
          </select>
          <select className="input" name="level">
            <option value="">{t('Any level')}</option>
            <option value="beginner">{t('Beginner')}</option>
            <option value="intermediate">{t('Intermediate')}</option>
            <option value="advanced">{t('Advanced')}</option>
          </select>
          <select className="input" name="price">
            <option value="">{t('Any price')}</option>
            <option value="free">{t('Free')}</option>
            <option value="paid">{t('Paid')}</option>
          </select>
        </div>
        <button className="btn-primary w-fit">{t('Save Search')}</button>
      </form>
      <DataTable
        headers={['Query', 'Created', 'Open'].map(t)}
        rows={rows.map((row) => [
          row.query,
          row.createdAt.toLocaleDateString(),
          <a key="o" className="text-[#1D9BF0]" href={savedSearchHref(row, categories)}>
            {t('Open')}
          </a>,
        ])}
      />
    </DashboardShell>
  );
}

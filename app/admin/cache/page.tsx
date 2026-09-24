import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { CACHE_REGISTRY, getCacheOverview } from '@/lib/cache';
import { getCsrfToken } from '@/lib/csrf';
import { CacheManagementClient } from './CacheManagementClient';

export default async function Cache() {
  await requireUser(['ADMIN']);
  const [overview, csrfToken] = await Promise.all([getCacheOverview(CACHE_REGISTRY), getCsrfToken()]);

  return (
    <DashboardShell role="admin" title="Advanced Cache Center">
      <CacheManagementClient csrfToken={csrfToken} initialOverview={overview} />
    </DashboardShell>
  );
}

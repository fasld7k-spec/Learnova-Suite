import { NextRequest, NextResponse } from 'next/server';

import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { createRoadmapItem, getRoadmapItems, roadmapStatuses, saveRoadmapItems, updateRoadmapItem, type RoadmapStatus } from '@/lib/admin-roadmap';
import { fail } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/roadmap', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function numberValue(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function statusValue(form: FormData): RoadmapStatus {
  const status = value(form, 'status');
  return roadmapStatuses.includes(status as RoadmapStatus) ? status as RoadmapStatus : 'Planned';
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');
    const items = await getRoadmapItems();

    if (action === 'delete') {
      if (!id) return fail('Roadmap item id is required.', 422);
      const next = items.filter((item) => item.id !== id);
      await saveRoadmapItems(next);
      await audit({ actorId: admin.id, action: 'roadmap.delete', entity: 'RoadmapItem', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Roadmap item id is required.', 422);
      const next = items.map((item) => item.id === id ? updateRoadmapItem(item, { active: !item.active }) : item);
      await saveRoadmapItems(next);
      await audit({ actorId: admin.id, action: 'roadmap.toggle', entity: 'RoadmapItem', entityId: id });
      return redirect(req);
    }

    const title = value(form, 'title');
    const description = value(form, 'description');
    const href = value(form, 'href') || '/admin/roadmap';
    if (title.length < 2) return fail('Roadmap title is required.', 422);
    if (description.length < 10) return fail('Roadmap description should explain the module.', 422);
    if (!href.startsWith('/')) return fail('Roadmap link must be an internal path.', 422);

    if (action === 'update') {
      if (!id) return fail('Roadmap item id is required.', 422);
      const current = items.find((item) => item.id === id);
      if (!current) return fail('Roadmap item not found.', 404);
      const next = items.map((item) => item.id === id
        ? updateRoadmapItem(item, {
            title,
            description,
            href,
            status: statusValue(form),
            sortOrder: numberValue(form, 'sortOrder', item.sortOrder),
            active: form.get('active') === 'on',
          })
        : item);
      await saveRoadmapItems(next);
      await audit({ actorId: admin.id, action: 'roadmap.update', entity: 'RoadmapItem', entityId: id });
      return redirect(req);
    }

    const row = createRoadmapItem({
      title,
      description,
      href,
      status: statusValue(form),
      sortOrder: numberValue(form, 'sortOrder', (items.length + 1) * 10),
      active: form.get('active') === 'on',
    });
    const uniqueId = items.some((item) => item.id === row.id) ? `${row.id}-${Date.now()}` : row.id;
    await saveRoadmapItems([...items, { ...row, id: uniqueId }]);
    await audit({ actorId: admin.id, action: 'roadmap.create', entity: 'RoadmapItem', entityId: uniqueId });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Roadmap update failed.', 500);
  }
}

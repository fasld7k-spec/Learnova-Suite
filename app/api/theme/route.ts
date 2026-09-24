import { prisma } from '@/lib/prisma';
import { fromJsonObject } from '@/lib/json-fields';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'theme' } });
    const v = fromJsonObject<any>(s?.value);
    const css = `:root{--brand:${v.primary || '#1D9BF0'};--brand-primary:${v.primary || '#1D9BF0'};--panel-strong:${v.secondary || '#16181C'};--brand-secondary:${v.secondary || '#16181C'};--radius:${v.radius || '9999px'};--font:${v.font || 'Chirp, Inter, system-ui'};}`;
    return new Response(css, { headers: { 'content-type': 'text/css; charset=utf-8' } });
  } catch {
    return new Response(':root{--brand:#1D9BF0;--brand-primary:#1D9BF0;--panel-strong:#16181C;--brand-secondary:#16181C;--radius:9999px;--font:Chirp, Inter, system-ui;}', {
      headers: { 'content-type': 'text/css; charset=utf-8' }
    });
  }
}

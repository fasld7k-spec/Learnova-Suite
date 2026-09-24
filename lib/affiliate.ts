import { addonNumberSetting, getAddonRuntime } from '@/lib/addons';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export function normalizeAffiliateCode(value: unknown) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 80);
}

export async function getAffiliateAddon() {
  const runtime = await getAddonRuntime('affiliate-growth');
  return {
    active: runtime.active,
    defaultCommission: Math.min(100, Math.max(0, addonNumberSetting(runtime.settings, 'defaultCommission', 15))),
    cookieDays: Math.min(365, Math.max(1, addonNumberSetting(runtime.settings, 'cookieDays', 30))),
  };
}

export async function resolveAffiliateAttribution(rawCode: unknown, buyerUserId: string) {
  const addon = await getAffiliateAddon();
  if (!addon.active) return null;
  const code = normalizeAffiliateCode(rawCode);
  if (!code) return null;
  const link = await prisma.affiliateLink.findUnique({ where: { code } });
  if (!link || link.userId === buyerUserId) return null;
  return { code: link.code, affiliateUserId: link.userId };
}

export async function paymentMetadataWithAffiliate(
  base: Record<string, unknown>,
  rawCode: unknown,
  buyerUserId: string
) {
  const attribution = await resolveAffiliateAttribution(rawCode, buyerUserId);
  return toJson({
    ...base,
    affiliateCode: attribution?.code,
    affiliateUserId: attribution?.affiliateUserId,
  });
}

export async function recordAffiliateCommissionForPaidOrder(order: {
  id: string;
  userId: string;
  total: unknown;
  payment?: { metadata?: unknown } | null;
}) {
  const addon = await getAffiliateAddon();
  if (!addon.active) return null;
  const metadata = fromJsonObject<{ affiliateCode?: string; affiliateUserId?: string }>(order.payment?.metadata);
  const code = normalizeAffiliateCode(metadata.affiliateCode);
  if (!code || !metadata.affiliateUserId || metadata.affiliateUserId === order.userId) return null;

  const link = await prisma.affiliateLink.findUnique({ where: { code } });
  if (!link || link.userId !== metadata.affiliateUserId) return null;

  const existing = await prisma.affiliateCommission.findFirst({
    where: { affiliateUserId: link.userId, orderId: order.id },
  });
  if (existing) return existing;

  const amount = Number(order.total || 0) * (addon.defaultCommission / 100);
  if (amount <= 0) return null;

  const commission = await prisma.affiliateCommission.create({
    data: {
      affiliateUserId: link.userId,
      orderId: order.id,
      amount,
      status: 'PENDING',
    },
  });
  await prisma.affiliateLink.update({ where: { id: link.id }, data: { sales: { increment: 1 } } }).catch(() => null);
  return commission;
}

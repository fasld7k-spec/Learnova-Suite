import { fromJsonArray, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

type CouponLike = {
  id: string;
  code: string;
  percent: number;
  discountType?: string | null;
  amount?: unknown;
  active: boolean;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  maxUses?: number | null;
  perUserLimit?: number | null;
  minOrderAmount?: unknown;
  courseIds?: string | null;
};

type CouponDb = Pick<typeof prisma, 'coupon' | 'couponRedemption'>;

export type CouponLine = {
  courseId: string;
  amount: number;
};

export type CouponResult = {
  valid: boolean;
  coupon?: CouponLike;
  couponId?: string;
  code?: string;
  discount: number;
  reason?: string;
};

function money(value: unknown) {
  return Math.max(0, Number(value || 0));
}

function reservationCutoff() {
  const date = new Date();
  date.setHours(date.getHours() - 2);
  return date;
}

function activeCouponRedemptionWhere(couponId: string, userId?: string) {
  return {
    couponId,
    ...(userId ? { userId } : {}),
    OR: [
      { orderId: null },
      { order: { status: 'PAID' } },
      { order: { status: 'PENDING', createdAt: { gte: reservationCutoff() } } },
    ],
  };
}

function scopedLines(coupon: CouponLike, lines: CouponLine[]) {
  const ids = fromJsonArray<string>(coupon.courseIds);
  if (!ids.length) return lines;
  return lines.filter((line) => ids.includes(line.courseId));
}

export function couponLabel(coupon: Pick<CouponLike, 'percent' | 'discountType' | 'amount'>, currency = 'USD') {
  if ((coupon.discountType || 'PERCENT') === 'FIXED') {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(money(coupon.amount));
  }
  return `${coupon.percent}%`;
}

export async function validateCouponForCheckout({
  code,
  userId,
  lines,
  db = prisma,
}: {
  code?: string | null;
  userId: string;
  lines: CouponLine[];
  db?: CouponDb;
}): Promise<CouponResult> {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return { valid: false, discount: 0, reason: 'No coupon code provided.' };

  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) return { valid: false, discount: 0, reason: 'Coupon code does not exist.' };
  if (!coupon.active) return { valid: false, coupon, discount: 0, reason: 'Coupon is disabled.' };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { valid: false, coupon, discount: 0, reason: 'Coupon is not active yet.' };
  if (coupon.expiresAt && coupon.expiresAt < now) return { valid: false, coupon, discount: 0, reason: 'Coupon has expired.' };

  const subtotal = lines.reduce((sum, line) => sum + money(line.amount), 0);
  if (subtotal < money(coupon.minOrderAmount)) {
    return { valid: false, coupon, discount: 0, reason: 'Order total is below the coupon minimum.' };
  }

  const matchingLines = scopedLines(coupon, lines);
  const eligibleSubtotal = matchingLines.reduce((sum, line) => sum + money(line.amount), 0);
  if (eligibleSubtotal <= 0) return { valid: false, coupon, discount: 0, reason: 'Coupon does not apply to these courses.' };

  if (coupon.maxUses) {
    const used = await db.couponRedemption.count({ where: activeCouponRedemptionWhere(coupon.id) });
    if (used >= coupon.maxUses) return { valid: false, coupon, discount: 0, reason: 'Coupon usage limit reached.' };
  }

  if (coupon.perUserLimit) {
    const usedByUser = await db.couponRedemption.count({ where: activeCouponRedemptionWhere(coupon.id, userId) });
    if (usedByUser >= coupon.perUserLimit) return { valid: false, coupon, discount: 0, reason: 'Coupon user limit reached.' };
  }

  const discount =
    coupon.discountType === 'FIXED'
      ? Math.min(eligibleSubtotal, money(coupon.amount))
      : Math.min(eligibleSubtotal, eligibleSubtotal * (coupon.percent / 100));

  return {
    valid: discount > 0,
    coupon,
    couponId: coupon.id,
    code: coupon.code,
    discount,
    reason: discount > 0 ? undefined : 'Coupon produced no discount.',
  };
}

export async function reserveCouponRedemption({
  couponId,
  userId,
  orderId,
  db = prisma,
}: {
  couponId?: string | null;
  userId: string;
  orderId: string;
  db?: CouponDb;
}) {
  if (!couponId) return null;
  const existing = await db.couponRedemption.findFirst({ where: { couponId, userId, orderId } });
  if (existing) return existing;
  return db.couponRedemption.create({ data: { couponId, userId, orderId } });
}

export function courseScopeToJson(raw: FormDataEntryValue | null | FormDataEntryValue[]) {
  const source = Array.isArray(raw) ? raw.join('\n') : String(raw || '');
  const ids = source
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length ? toJson(ids) : null;
}

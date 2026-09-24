import { prisma } from '@/lib/prisma';

export type CheckoutPricingContext = {
  currency: string;
  exchangeRate: number;
  taxRates: Array<{
    name: string;
    country: string;
    percent: number;
  }>;
};

export type CheckoutPricingLine = {
  courseId: string;
  amount: number;
};

export type PricedCheckoutLine = CheckoutPricingLine & {
  baseAmount: number;
  convertedAmount: number;
  discount: number;
  tax: number;
  total: number;
};

export type CheckoutPricing = {
  currency: string;
  exchangeRate: number;
  subtotal: number;
  discount: number;
  tax: number;
  taxPercent: number;
  total: number;
  taxRates: CheckoutPricingContext['taxRates'];
  lines: PricedCheckoutLine[];
};

function money(value: unknown) {
  return Math.max(0, Number(value || 0));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function allocateAmount(lines: Array<{ courseId: string; amount: number }>, amount: number) {
  const allocations = new Map<string, number>();
  const total = lines.reduce((sum, line) => sum + money(line.amount), 0);
  let allocated = 0;

  lines.forEach((line, index) => {
    const share = total > 0 ? (money(line.amount) / total) * amount : 0;
    const rounded = index === lines.length - 1 ? roundMoney(amount - allocated) : roundMoney(share);
    allocated = roundMoney(allocated + rounded);
    allocations.set(line.courseId, Math.max(0, rounded));
  });

  return allocations;
}

export async function resolveCheckoutPricingContext(currency: string, taxCountry?: string | null): Promise<CheckoutPricingContext> {
  const normalizedCurrency = String(currency || 'USD').trim().toUpperCase();
  const normalizedCountry = String(taxCountry || '').trim().toUpperCase();
  const [currencyRow, activeTaxRates] = await Promise.all([
    prisma.currency.findFirst({ where: { code: normalizedCurrency, active: true } }).catch(() => null),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }).catch(() => []),
  ]);
  const exchangeRate = money(currencyRow?.exchangeRate) || 1;
  const matchingTaxRates = normalizedCountry
    ? activeTaxRates.filter((rate) => rate.country.toUpperCase() === normalizedCountry)
    : activeTaxRates.length === 1
      ? activeTaxRates
      : [];

  return {
    currency: normalizedCurrency,
    exchangeRate,
    taxRates: matchingTaxRates.map((rate) => ({
      name: rate.name,
      country: rate.country,
      percent: money(rate.percent),
    })),
  };
}

export function priceCheckoutLines({
  lines,
  discount = 0,
  context,
}: {
  lines: CheckoutPricingLine[];
  discount?: number;
  context: CheckoutPricingContext;
}): CheckoutPricing {
  const pricedBaseLines = lines.map((line) => ({
    courseId: line.courseId,
    baseAmount: money(line.amount),
    convertedAmount: roundMoney(money(line.amount) * (money(context.exchangeRate) || 1)),
  }));
  const subtotal = roundMoney(pricedBaseLines.reduce((sum, line) => sum + line.convertedAmount, 0));
  const safeDiscount = Math.min(subtotal, roundMoney(money(discount)));
  const taxableSubtotal = Math.max(0, roundMoney(subtotal - safeDiscount));
  const taxPercent = context.taxRates.reduce((sum, rate) => sum + money(rate.percent), 0);
  const tax = taxableSubtotal > 0 ? roundMoney(taxableSubtotal * (taxPercent / 100)) : 0;
  const total = roundMoney(taxableSubtotal + tax);
  const discountByLine = allocateAmount(
    pricedBaseLines.map((line) => ({ courseId: line.courseId, amount: line.convertedAmount })),
    safeDiscount
  );
  const taxableByLine = pricedBaseLines.map((line) => ({
    courseId: line.courseId,
    amount: Math.max(0, roundMoney(line.convertedAmount - (discountByLine.get(line.courseId) || 0))),
  }));
  const taxByLine = allocateAmount(taxableByLine, tax);

  return {
    currency: context.currency,
    exchangeRate: context.exchangeRate,
    subtotal,
    discount: safeDiscount,
    tax,
    taxPercent,
    total,
    taxRates: context.taxRates,
    lines: pricedBaseLines.map((line) => {
      const lineDiscount = discountByLine.get(line.courseId) || 0;
      const lineTax = taxByLine.get(line.courseId) || 0;
      const lineTotal = roundMoney(Math.max(0, line.convertedAmount - lineDiscount) + lineTax);
      return {
        ...line,
        amount: line.convertedAmount,
        discount: lineDiscount,
        tax: lineTax,
        total: lineTotal,
      };
    }),
  };
}

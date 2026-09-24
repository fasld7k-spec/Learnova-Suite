import { addonBooleanSetting, addonStringSetting, getAddonRuntime } from '@/lib/addons';
export {
  certificateTemplatePreviewVariables,
  certificateTemplateVariables,
  defaultCertificateTemplateHtml,
  escapeCertificateTemplateValue,
  renderCertificateTemplate,
  sanitizeCertificateTemplateHtml,
  type CertificateTemplateVariable,
} from '@/lib/certificate-templates';
import { prisma } from '@/lib/prisma';

export async function getCertificateAddon() {
  const runtime = await getAddonRuntime('advanced-certificates');
  return {
    active: runtime.active,
    prefix: addonStringSetting(runtime.settings, 'certificatePrefix', 'CERT').toUpperCase(),
    showQrCode: addonBooleanSetting(runtime.settings, 'showQrCode', true),
  };
}

export function displayCertificateCode(code: string, prefix: string) {
  const normalized = code.trim().toUpperCase();
  return normalized.startsWith(`${prefix}-`) ? normalized : `${prefix}-${normalized}`;
}

export function normalizeCertificateLookupCode(raw: string, prefix = 'CERT') {
  const normalized = raw.trim().toUpperCase();
  return normalized.startsWith(`${prefix}-`) ? normalized.slice(prefix.length + 1) : normalized;
}

export function certificateLookupCandidates(raw: string, prefix = 'CERT') {
  const normalized = raw.trim().toUpperCase();
  const stripped = normalizeCertificateLookupCode(raw, prefix);
  return Array.from(new Set([normalized, stripped].filter(Boolean)));
}

export async function getActiveCertificateTemplate() {
  return prisma.certificateTemplate.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  });
}

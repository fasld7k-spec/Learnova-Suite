export type CertificateTemplateVariable =
  | 'student'
  | 'course'
  | 'instructor'
  | 'issuedAt'
  | 'code'
  | 'verifyUrl'
  | 'printUrl'
  | 'qrUrl'
  | 'siteName';

export const certificateTemplateVariables: CertificateTemplateVariable[] = [
  'student',
  'course',
  'instructor',
  'issuedAt',
  'code',
  'verifyUrl',
  'printUrl',
  'qrUrl',
  'siteName',
];

export const certificateTemplatePreviewVariables: Record<CertificateTemplateVariable, string> = {
  student: 'Maya Hassan',
  course: 'Next.js SaaS Masterclass',
  instructor: 'Sarah Instructor',
  issuedAt: '5/16/2026',
  code: 'CERT-DEMO-SAAS-MAYA',
  verifyUrl: '/certificates/verify?code=CERT-DEMO-SAAS-MAYA',
  printUrl: '/certificates/CERT-DEMO-SAAS-MAYA/print',
  qrUrl: '/api/certificates/qr/CERT-DEMO-SAAS-MAYA',
  siteName: 'Learnova Suite',
};

export const defaultCertificateTemplateHtml = `<div style="font-family: Inter, Arial, sans-serif; background:#fff; color:#111; border:4px solid #111; padding:32px; text-align:center; max-width:1080px; margin:0 auto; box-sizing:border-box; overflow-wrap:break-word;">
  <div style="font-size:13px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#1D9BF0;">{{siteName}}</div>
  <h1 style="margin:22px 0 8px; font-size:38px; line-height:1.05; font-weight:900; word-break:break-word;">Certificate of Completion</h1>
  <p style="margin:20px auto 0; max-width:720px; color:#555; font-size:18px;">This certifies that</p>
  <div style="margin:16px auto 0; font-size:34px; line-height:1.1; font-weight:900; word-break:break-word;">{{student}}</div>
  <p style="margin:22px auto 0; max-width:720px; color:#555; font-size:18px;">has successfully completed</p>
  <div style="margin:14px auto 0; max-width:860px; color:#1D9BF0; font-size:28px; line-height:1.15; font-weight:900; word-break:break-word;">{{course}}</div>
  <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:42px; text-align:left;">
    <div style="border:1px solid #111; padding:16px; flex:1 1 220px;"><strong>Instructor</strong><br><span style="color:#555;">{{instructor}}</span></div>
    <div style="border:1px solid #111; padding:16px; flex:1 1 220px;"><strong>Issued</strong><br><span style="color:#555;">{{issuedAt}}</span></div>
    <div style="border:1px solid #111; padding:16px; flex:1 1 220px;"><strong>Code</strong><br><span style="color:#555;">{{code}}</span></div>
  </div>
  <div style="margin-top:34px; display:flex; align-items:center; justify-content:center; gap:16px; flex-wrap:wrap;">
    <img src="{{qrUrl}}" alt="Verification QR code" style="width:112px; height:112px;">
    <div style="text-align:left; max-width:420px;">
      <strong>Verified credential</strong>
      <p style="margin:6px 0 0; color:#555;">Verify this certificate at {{verifyUrl}}</p>
    </div>
  </div>
</div>`;

export function escapeCertificateTemplateValue(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeCertificateTemplateHtml(html: string) {
  const trimmed = html.trim();
  if (!trimmed) throw new Error('Certificate template HTML is required');
  if (trimmed.length > 30000) throw new Error('Certificate template HTML is too large');

  const unsafePatterns = [
    /<\s*script\b/i,
    /<\s*iframe\b/i,
    /<\s*object\b/i,
    /<\s*embed\b/i,
    /<\s*link\b/i,
    /<\s*meta\b/i,
    /\son[a-z]+\s*=/i,
    /javascript\s*:/i,
    /data\s*:\s*text\/html/i,
  ];

  if (unsafePatterns.some((pattern) => pattern.test(trimmed))) {
    throw new Error('Certificate template contains unsafe HTML');
  }

  return trimmed;
}

export function renderCertificateTemplate(html: string, variables: Record<CertificateTemplateVariable, string>) {
  const safeVariables = Object.fromEntries(
    certificateTemplateVariables.map((key) => [key, escapeCertificateTemplateValue(variables[key])])
  ) as Record<CertificateTemplateVariable, string>;

  return sanitizeCertificateTemplateHtml(html).replace(/{{\s*([a-zA-Z]+)\s*}}/g, (token, rawKey: string) => {
    const key = rawKey as CertificateTemplateVariable;
    return certificateTemplateVariables.includes(key) ? safeVariables[key] : token;
  });
}

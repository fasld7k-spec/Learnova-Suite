import { Braces, Eye, Mail } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { emailTemplates, getEditableEmailTemplates } from '@/lib/email';

function sampleValue(variable: string) {
  const samples: Record<string, string> = {
    amount: '149.00',
    assignmentTitle: 'Final project',
    certificateUrl: 'https://example.com/certificates/ABC-123',
    comment: 'The course was clear and practical.',
    courseTitle: 'Next.js SaaS Masterclass',
    courseUrl: 'https://example.com/courses/nextjs-saas-masterclass',
    currency: 'USD',
    dashboardUrl: 'https://example.com/dashboard',
    editUrl: 'https://example.com/instructor/courses',
    expiresAt: 'June 30, 2026',
    expiresIn: '30 minutes',
    feedback: 'Great work and clean implementation.',
    grade: '96%',
    goalTitle: 'Complete the launch checklist',
    instructorName: 'Sarah Instructor',
    invoiceNumber: 'INV-2026-001',
    joinUrl: 'https://example.com/live/session',
    name: 'Alex Learner',
    planName: 'Pro',
    rating: '5',
    reference: 'PAYOUT-1001',
    refundId: 'REF-2026-001',
    rejectionReason: 'Please add one more lesson resource.',
    resetUrl: 'https://example.com/reset-password',
    reviewsUrl: 'https://example.com/instructor/reviews',
    score: '92',
    siteName: 'Learnova',
    startsAt: 'May 22, 2026 7:00 PM',
    status: 'approved',
    studentName: 'Alex Learner',
    supportUrl: 'https://example.com/support',
    ticketSubject: 'Payment receipt question',
    ticketUrl: 'https://example.com/support/tickets/1001',
    verificationUrl: 'https://example.com/verify-email',
  };
  return samples[variable] || `Sample ${variable}`;
}

function renderPreview(value: string, variables: string[]) {
  const rendered = variables.reduce((html, variable) => {
    return html.replace(new RegExp(`\\{\\{\\s*${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g'), sampleValue(variable));
  }, value);

  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff;color:#111;font-family:Inter,Arial,sans-serif;line-height:1.55;padding:24px}a{color:#1D9BF0}h1,h2,h3{line-height:1.2}</style></head><body>${rendered}</body></html>`;
}

export default async function EmailTemplates() {
  await requireUser(['ADMIN']);
  const templates = await getEditableEmailTemplates();
  const defaultTemplates = new Map(emailTemplates.map((template) => [template.key, template]));

  return (
    <DashboardShell role="admin" title="Email Templates">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <Mail className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-3xl font-black text-white">{emailTemplates.length}</p>
          <p className="mt-1 text-sm font-bold text-[#71767B]">System templates</p>
        </div>
        <div className="card">
          <Eye className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-lg font-black text-white">Visual preview</p>
          <p className="mt-1 text-sm text-[#71767B]">Review how each email reads before it is sent through the active provider.</p>
        </div>
        <div className="card">
          <Braces className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-lg font-black text-white">Placeholders</p>
          <p className="mt-1 text-sm text-[#71767B]">Each template lists the dynamic values filled by platform events.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => {
          const defaultTemplate = defaultTemplates.get(template.key);
          const isCustomized = template.subject !== defaultTemplate?.subject || template.html !== defaultTemplate?.html;

          return (
            <article key={template.key} className="border border-[#2F3336] bg-black p-5">
              <form className="grid gap-5" action="/api/admin/email-templates" method="post">
                <CsrfInput />
                <input type="hidden" name="key" value={template.key} />
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black text-white">{template.name}</h2>
                      <Badge tone="blue">{template.audience}</Badge>
                      {isCustomized ? <Badge tone="yellow">Customized</Badge> : <Badge tone="green">Default</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-[#71767B]">{template.description}</p>
                  </div>
                  <code className="w-fit border border-[#2F3336] bg-[#16181C] px-3 py-2 text-xs text-[#E7E9EA]">{template.trigger}</code>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#71767B]">Subject</p>
                    <input className="input mt-2" name="subject" defaultValue={template.subject} />
                    <p className="mt-5 text-xs font-bold uppercase text-[#71767B]">Variables</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {template.variables.map((variable) => (
                        <code key={variable} className="border border-[#2F3336] bg-[#16181C] px-2 py-1 text-xs text-[#E7E9EA]">
                          {`{{${variable}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                  <div className="border border-[#2F3336] bg-[#16181C] p-4">
                    <p className="text-xs font-bold uppercase text-[#71767B]">HTML body</p>
                    <textarea className="input mt-3 min-h-44 rounded-2xl" name="html" defaultValue={template.html} />
                    <div className="mt-4 overflow-hidden border border-[#2F3336] bg-white">
                      <div className="border-b border-[#2F3336] bg-black px-3 py-2 text-xs font-black uppercase tracking-wide text-[#71767B]">
                        Rendered preview with sample data
                      </div>
                      <iframe
                        className="h-64 w-full bg-white"
                        sandbox=""
                        title={`${template.name} preview`}
                        srcDoc={renderPreview(template.html, template.variables)}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button className="btn-primary w-fit" name="intent" value="save">
                        Save template
                      </button>
                      <button className="btn-secondary w-fit" name="intent" value="reset" disabled={!isCustomized} formNoValidate>
                        Reset to default
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </article>
          );
        })}
      </div>
    </DashboardShell>
  );
}

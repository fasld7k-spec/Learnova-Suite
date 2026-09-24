import { BarChart3, Download, GraduationCap, LogIn, ReceiptText, ShieldCheck, SmilePlus, UsersRound } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';

const exports = [
  { title: 'Users CSV', href: '/api/admin/export/users', description: 'Export students, instructors, admins, roles, and account status.', icon: UsersRound },
  { title: 'Orders CSV', href: '/api/admin/export/orders', description: 'Export order totals, payment status, customer emails, and invoice data.', icon: ReceiptText },
  { title: 'Courses CSV', href: '/api/admin/export/courses', description: 'Export catalog records, instructors, prices, categories, and approval status.', icon: GraduationCap },
  { title: 'Reports CSV', href: '/api/admin/reports/export', description: 'Export revenue, orders, enrollments, top courses, coupon usage, and instructor earnings.', icon: BarChart3 },
  { title: 'Audit Logs CSV', href: '/api/admin/audit-logs/export', description: 'Export recent admin actions, entities, actor IDs, metadata, and timestamps for compliance review.', icon: ShieldCheck },
  { title: 'Login History CSV', href: '/api/admin/login-history/export', description: 'Export successful and failed login attempts with IP and user agent evidence.', icon: LogIn },
  { title: 'NPS Feedback CSV', href: '/api/admin/nps', description: 'Export NPS scores, segments, comments, linked users, and submission dates.', icon: SmilePlus },
];

export default async function ExportCenter() {
  await requireUser(['ADMIN']);

  return (
    <DashboardShell role="admin" title="Export Center">
      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#71767B]">Data portability</p>
        <h2 className="mt-2 text-2xl font-black text-white">Operational CSV exports</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          Download buyer-friendly CSV files for finance, catalog review, compliance, support analysis, and launch handoff.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {exports.map((item) => {
          const Icon = item.icon;
          return (
            <a className="card block transition hover:border-[#1D9BF0]" href={item.href} key={item.href}>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[#2F3336] text-[#1D9BF0]">
                <Icon size={19} />
              </span>
              <h2 className="mt-4 text-xl font-black text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#71767B]">{item.description}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#1D9BF0]">
                <Download size={16} />
                Download
              </span>
            </a>
          );
        })}
      </div>
    </DashboardShell>
  );
}

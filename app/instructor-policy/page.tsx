import { BadgeCheck, GraduationCap, ShieldAlert } from 'lucide-react';
import { ManagedPage } from '@/components/ManagedPage';

const sections = [
  { title: 'Quality standards', body: 'Courses should include accurate descriptions, structured lessons, usable resources, and timely student support.', icon: GraduationCap },
  { title: 'Compliance', body: 'Instructors must avoid prohibited content, misleading claims, plagiarism, spam, and unsafe learning experiences.', icon: ShieldAlert },
  { title: 'Review rights', body: 'Admins may approve, reject, unpublish, or request changes to courses that do not meet marketplace standards.', icon: BadgeCheck }
];

export default function InstructorPolicy() {
  return (
    <ManagedPage slug="instructor-policy" eyebrow="Legal" title="Instructor Policy" description="Marketplace expectations for instructor conduct, course quality, student communication, and content review.">
      <div className="page-shell mt-8 grid gap-6 md:grid-cols-3">
          {sections.map(({ title, body, icon: Icon }) => (
            <div className="moe-panel moe-card-shine p-6" key={title}>
              <span className="moe-mini-icon">
                <Icon size={22} />
              </span>
              <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
            </div>
          ))}
      </div>
    </ManagedPage>
  );
}

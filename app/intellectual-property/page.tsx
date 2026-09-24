import { BadgeCheck, FileWarning, ShieldCheck } from 'lucide-react';
import { ManagedPage } from '@/components/ManagedPage';

const sections = [
  { title: 'Instructor content', body: 'Instructors must own, license, or have permission to publish every course asset, quiz, download, and media item.', icon: BadgeCheck },
  { title: 'Learner use', body: 'Course access is for enrolled users and must not be copied, resold, redistributed, or used to train competing materials.', icon: ShieldCheck },
  { title: 'Claims', body: 'Rights holders can submit a notice with ownership details, affected URLs, and contact information for review.', icon: FileWarning }
];

export default function IntellectualProperty() {
  return (
    <ManagedPage slug="intellectual-property" eyebrow="Legal" title="Intellectual Property" description="This policy describes ownership expectations, content usage limits, and how rights concerns are reviewed.">
      <div className="mt-8 grid gap-6 md:grid-cols-3">
          {sections.map(({ title, body, icon: Icon }) => (
            <div className="border border-[#2F3336] bg-black p-6" key={title}>
              <Icon size={22} className="text-[#1D9BF0]" />
              <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#71767B]">{body}</p>
            </div>
          ))}
      </div>
    </ManagedPage>
  );
}

import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const user = await requireUser();
  const fields = await prisma.userProfileField.findMany({ where: { userId: user.id } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <form className="moe-panel-soft mx-auto max-w-2xl p-8" action="/api/profile" method="post">
          <CsrfInput />
          <h1 className="text-3xl font-black text-white">My Profile</h1>
          <input className="input mt-6" name="name" defaultValue={user.name} />
          <textarea className="input mt-3" name="bio" defaultValue={user.bio || ''} />
          <input className="input mt-3" name="avatar" defaultValue={user.avatar || ''} placeholder="Avatar URL" />
          <button className="moe-primary mt-5 px-5 py-3">Update Profile</button>
        </form>
        <div className="moe-panel mx-auto mt-6 max-w-2xl p-8">
          <h2 className="text-xl font-bold text-white">Custom Fields</h2>
          {fields.map((field) => (
            <p key={field.id} className="mt-2 text-slate-300">
              <b className="text-white">{field.key}:</b> {field.value}
            </p>
          ))}
          {fields.length === 0 && <p className="mt-3 text-slate-400">No custom fields yet.</p>}
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

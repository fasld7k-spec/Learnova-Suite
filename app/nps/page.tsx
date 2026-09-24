import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';

export default async function Nps(props: { searchParams?: Promise<{ submitted?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const submitted = searchParams?.submitted === '1';
  return (
    <>
      <Nav />
      <main className="moe-page grid min-h-[calc(100vh-180px)] items-center py-12">
        <form className="moe-panel mx-auto w-full max-w-xl p-8" action="/api/nps" method="post">
          <CsrfInput />
          <h1 className="text-3xl font-black text-white">How likely are you to recommend us?</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Your score helps the marketplace team improve courses, support, and checkout quality.</p>
          {submitted ? <p className="mt-5 rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-100">Thanks. Your feedback was saved successfully.</p> : null}
          <input className="moe-control mt-6 w-full" type="number" min="0" max="10" name="score" placeholder="0-10" required />
          <textarea className="moe-control mt-3 min-h-32 w-full" name="comment" placeholder="Comment" />
          <button className="moe-primary mt-4">Submit</button>
        </form>
      </main>
      <Footer />
    </>
  );
}

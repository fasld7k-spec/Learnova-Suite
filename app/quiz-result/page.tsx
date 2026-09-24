import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';

export default async function QuizResult(props: { searchParams: Promise<{ score?: string; passed?: string }> }) {
  const searchParams = await props.searchParams;
  const passed = searchParams.passed === 'true';

  return (
    <>
      <Nav />
      <main className="moe-page grid min-h-[calc(100vh-180px)] items-center py-12">
        <section className="page-shell w-full">
        <div className="moe-panel-soft mx-auto max-w-xl p-8 text-center">
          <h1 className="text-4xl font-black text-white">Quiz Result</h1>
          <p className="mt-4 text-2xl font-bold text-white">Score: {searchParams.score || 0}%</p>
          <p className={`mt-3 font-bold ${passed ? 'text-[#00BA7C]' : 'text-[#F4212E]'}`}>{passed ? 'Passed' : 'Try again'}</p>
          <a className="moe-primary mt-6 px-5 py-3" href="/student/courses">
            Back to courses
          </a>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

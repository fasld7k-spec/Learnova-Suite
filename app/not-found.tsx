import { ArrowLeft, Search } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="page-shell grid min-h-[calc(100vh-180px)] items-center py-12">
        <section className="mx-auto max-w-2xl border border-[#2F3336] bg-black p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#2F3336] bg-[#16181C] text-[#1D9BF0]">
            <Search size={24} />
          </div>
          <p className="eyebrow mt-8">404</p>
          <h1 className="mt-3 text-4xl font-black text-white">Page not found.</h1>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-[#71767B]">
            The page may have moved, or this record is no longer available.
          </p>
          <a className="btn-primary mt-8" href="/courses">
            <ArrowLeft size={17} />
            Browse Courses
          </a>
        </section>
      </main>
      <Footer />
    </>
  );
}

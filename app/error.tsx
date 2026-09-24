'use client';

import { RotateCcw } from 'lucide-react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-8 text-white">
      <div className="max-w-lg border border-[#2F3336] bg-black p-8 text-center">
        <h1 className="text-3xl font-black">Something went wrong</h1>
        <p className="mt-3 text-[#71767B]">{error.message || 'The app hit an unexpected error.'}</p>
        <button className="btn-primary mt-6" onClick={reset}>
          <RotateCcw size={17} />
          Try again
        </button>
      </div>
    </main>
  );
}

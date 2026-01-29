'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function ShareContent() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get('s');

  useEffect(() => {
    // Redirect to main app with state after a brief moment
    // This allows the OG image to be fetched first
    const timer = setTimeout(() => {
      if (stateParam) {
        window.location.href = `/?s=${stateParam}`;
      } else {
        window.location.href = '/';
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [stateParam]);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-pulse text-2xl mb-4">🧲</div>
        <p className="text-zinc-400">Opening BasePaint Fridge...</p>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-pulse text-2xl mb-4">🧲</div>
            <p className="text-zinc-400">Loading...</p>
          </div>
        </div>
      }
    >
      <ShareContent />
    </Suspense>
  );
}

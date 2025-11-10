'use client';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[AuthSegmentError]', error);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <h2 className="text-xl font-semibold mb-2">Sign in error</h2>
        <pre className="text-red-700 bg-red-50 p-3 rounded-lg overflow-auto">
          {error?.message || 'Unknown error'}
        </pre>
        <button
          onClick={() => reset()}
          className="mt-4 rounded-lg border px-3 py-2 text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  );
}







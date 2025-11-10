'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Something went wrong</h2>
      <p>{error?.message ?? 'Unexpected error'}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}


'use client';

export default function OnboardingError({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <div style={{ padding: 24 }}>
      <h3>Onboarding error</h3>
      <p>{error?.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  );
}





// This layout only applies to sign-in page
// Sign-up page has moved to app/sign-up/ to use its own layout
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


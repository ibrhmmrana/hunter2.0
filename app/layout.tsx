import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

export const metadata: Metadata = {
  title: 'Hunter',
  description: 'Business growth analytics',
};

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.className} bg-[#f8fafc] text-slate-900`}>
        {children}
      </body>
    </html>
  );
}


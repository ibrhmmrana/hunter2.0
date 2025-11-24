import './globals.css';
import type { Metadata } from 'next';
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import MaterialProviders from "@/src/providers/MaterialProviders";
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'Hunter',
  description: 'Business growth analytics',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <AppRouterCacheProvider>
          <MaterialProviders>
        {children}
          </MaterialProviders>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}


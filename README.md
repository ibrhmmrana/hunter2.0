# Hunter Web App

A Next.js 14 application for business growth analytics and competitor tracking.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:
```bash
cp .env.local.example .env.local
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/onboarding/` - Pre-paywall pages (no sidebar)
- `app/(app)/` - Post-paywall pages (with sidebar)
- `components/` - React components
- `lib/` - Utility functions and Supabase clients

## Features

- Supabase authentication (magic link)
- Onboarding flow
- Dashboard with analytics
- Competitor tracking
- Social media scheduler
- Marketplace
- Alerts system


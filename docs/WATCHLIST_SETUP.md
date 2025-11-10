# Watchlist Feature Setup

This document describes the Watchlist feature implementation and how to set up the daily monitoring cron job.

## Overview

The Watchlist feature allows users to:
1. Add competitors to their watchlist from the `/competitors` page
2. Automatically detect social media profiles from Google Places data
3. Manually add missing social profiles
4. Receive alerts when competitors:
   - Get new negative Google reviews
   - Post new content on Instagram/TikTok/Facebook
   - Have trending posts (high engagement)

## Database Tables

Three new tables were created:

1. **`watchlist_competitors`** - Tracks which competitors users are watching
2. **`watchlist_social_profiles`** - Stores social media profiles to monitor per competitor
3. **`alerts`** - Central store for all notifications

See `supabase/migrations/20250127000000_create_watchlist_tables.sql` for schema details.

## API Endpoints

### `POST /api/watchlist`
Add a competitor to the watchlist. Auto-detects social profiles from Google Places data.

**Body:**
```json
{
  "competitor_place_id": "ChIJ...",
  "competitor_name": "Competitor Name",
  "competitor_address": "123 Main St"
}
```

**Response:**
```json
{
  "ok": true,
  "watchlist_id": "uuid",
  "foundNetworks": ["google", "instagram"],
  "missingNetworks": ["tiktok", "facebook"]
}
```

### `POST /api/watchlist/socials`
Add manual social media profiles.

**Body:**
```json
{
  "watchlist_id": "uuid",
  "socials": [
    { "network": "instagram", "handle_or_url": "@username" },
    { "network": "tiktok", "handle_or_url": "@username" }
  ]
}
```

### `GET /api/watchlist`
Get user's watchlist.

### `GET /api/alerts/unread-count`
Get count of unread alerts.

### `PATCH /api/alerts/:id`
Mark an alert as read.

**Body:**
```json
{
  "read": true
}
```

### `POST /api/watchlist/monitor`
Daily monitoring job (protected by CRON_SECRET).

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

## Setting Up the Cron Job

### Option 1: Using Vercel Cron (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/watchlist/monitor",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Set the `CRON_SECRET` environment variable in Vercel:
```bash
CRON_SECRET=your-secret-key-here
```

Vercel will automatically call the endpoint with the secret in the `x-vercel-cron` header. Update the route to check for this header:

```typescript
// In app/api/watchlist/monitor/route.ts
const vercelCron = request.headers.get("x-vercel-cron");
const authHeader = request.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (vercelCron !== "1" && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
```

### Option 2: Using External Cron Service

Use a service like:
- **cron-job.org** - Free cron service
- **EasyCron** - Paid service with better reliability
- **GitHub Actions** - Free for public repos

Set up a daily job that calls:
```
POST https://your-domain.com/api/watchlist/monitor
Authorization: Bearer <CRON_SECRET>
```

### Option 3: Using Supabase Cron (pg_cron)

If using Supabase, you can set up a database function and schedule it:

```sql
-- Create a function that calls your API
CREATE OR REPLACE FUNCTION watchlist_monitor_job()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use http extension to call your API
  PERFORM net.http_post(
    url := 'https://your-domain.com/api/watchlist/monitor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret')
    )
  );
END;
$$;

-- Schedule it to run daily at 9 AM
SELECT cron.schedule(
  'watchlist-monitor',
  '0 9 * * *',
  $$SELECT watchlist_monitor_job()$$
);
```

## Environment Variables

Add to your `.env.local`:

```bash
CRON_SECRET=your-secret-key-here
```

## UI Components

### Watchlist Button
- Located on competitor cards in `/competitors` page
- Shows "Add to watchlist" or "Watching" state
- Opens modal for missing social profiles

### Alerts Page
- Full list of alerts at `/alerts`
- Shows read/unread status
- Click to mark as read

### Dashboard Widget
- Shows latest 3 alerts on dashboard
- Links to full alerts page

### Sidebar Badge
- Shows unread alert count next to "Alerts" nav item
- Updates every 30 seconds

## Monitoring Logic

The monitoring job:

1. **Google Reviews:**
   - Fetches latest reviews via Apify
   - Compares against `last_seen_external_id`
   - Creates alerts for new negative reviews (≤3 stars)

2. **Instagram/TikTok/Facebook:**
   - Fetches latest posts via Apify
   - Compares against `last_seen_external_id`
   - Creates alerts for new posts
   - Detects trending posts (engagement > 2x average)

3. **Idempotency:**
   - Uses `last_seen_external_id` to prevent duplicate alerts
   - Updates after processing each profile

## Testing

To test the monitoring job manually:

```bash
curl -X POST https://your-domain.com/api/watchlist/monitor \
  -H "Authorization: Bearer your-cron-secret"
```

## Future Enhancements

- [ ] Add email notifications for critical alerts
- [ ] Add Slack/Discord webhook integration
- [ ] Add alert preferences (which types to receive)
- [ ] Add batch processing for large watchlists
- [ ] Add retry logic for failed API calls
- [ ] Add monitoring dashboard for job status


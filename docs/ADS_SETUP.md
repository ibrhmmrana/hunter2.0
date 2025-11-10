# My Ads Feature Setup

## Overview
The "My Ads" feature uses OpenAI's `gpt-image-1` model to generate AI-powered advertisements for businesses.

## Prerequisites

### 1. Environment Variables
Add to your `.env.local`:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Database Migration
Run the migration to create the `ads` table:
```bash
# The migration file is already created at:
# supabase/migrations/20250128000000_create_ads_table.sql
```

### 3. Supabase Storage Bucket (Optional but Recommended)
For production, create a storage bucket for ad images:

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `ads`
3. Set it to **Public** (or use signed URLs)
4. Configure RLS policies if needed

**Note:** Currently, the implementation uses data URLs for images. To use Supabase storage, uncomment the storage upload code in `app/api/ads/generate/route.ts`.

## API Endpoints

### POST /api/ads/generate-image
Generates an AI image ad using OpenAI's `gpt-image-1` model.

**Request (multipart/form-data):**
- `image`: File (required) - user's raw dish/product image
- `businessName`: string (required)
- `tagline`: string (required) - usually dish or offer name
- `address`: string (optional)
- `phone`: string (optional)
- `preset`: string (required) - e.g. "restaurant-new-dish", "restaurant_new_dish"

**Response:**
```json
{
  "ok": true,
  "imageBase64": "<base64-encoded-image>"
}
```

### POST /api/ads/save
Saves a generated ad to the database.

**Request:**
- `type`: "image" | "video"
- `category`: string
- `preset_key`: string
- `title`: string
- `output_url`: string (data URL or storage URL)
- `businessName`, `tagline`, `phone`, `website`, `address`: metadata

**Response:**
```json
{
  "ok": true,
  "id": "ad-uuid"
}
```

### POST /api/ads/generate (Legacy - for video)
Generates an AI video ad (still uses Gemini/Veo when implemented).

**Request:**
- `type`: "video"
- `category`: string
- `preset_key`: string (from adPresets.ts)
- `title`: string
- `businessName`: string (required)
- `tagline`: string
- `phone`: string (optional)
- `website`: string (optional)
- `address`: string (optional)
- `inputImage`: File (optional)

**Response:**
```json
{
  "ok": true,
  "id": "ad-uuid",
  "status": "generating"
}
```

## Ad Presets

Presets are defined in `lib/adPresets.ts`. Each preset includes:
- Label and description
- Media type (image/video)
- Recommended aspect ratio
- Prompt template

## Current Limitations

1. **Video Generation**: Not yet implemented (placeholder in code)
2. **Storage**: Currently uses data URLs - should migrate to Supabase storage for production
3. **Image Generation**: Uses OpenAI's `gpt-image-1` model for image editing/generation

## Future Enhancements

- [ ] Implement Veo video generation
- [ ] Upload generated images to Supabase storage
- [ ] Add image editing capabilities
- [ ] Add duplicate/edit/delete functionality
- [ ] Add batch generation
- [ ] Add preset customization

## Testing

1. Navigate to `/ads`
2. Follow the wizard:
   - Select category
   - Choose format (image/video)
   - Pick a preset
   - Fill in business details
   - Upload image (if required)
   - Generate ad
3. Check the gallery for generated ads

## Troubleshooting

### "OPENAI_API_KEY environment variable is not set"
- Ensure the environment variable is set in `.env.local`
- Restart your development server

### "Failed to generate ad image"
- Check OpenAI API key is valid
- Verify API quota/limits
- Ensure you have access to `gpt-image-1` model
- Check console logs for detailed error messages

### Images not displaying
- Check if generated image URL is accessible
- For data URLs, ensure they're not too large
- Consider migrating to Supabase storage


/**
 * Ad presets registry for AI ad generation
 */

import { AdPreset } from "./gemini";

export const AD_PRESETS: Record<string, AdPreset> = {
  // Restaurant - Image
  restaurant_new_dish: {
    label: "New Dish On The Menu",
    description: "Announce a new menu item with appetizing visuals",
    mediaType: "image",
    recommendedAspectRatio: "9:16", // Instagram Story format
    promptTemplate: `You are an art director for high-converting restaurant ads.

Transform the uploaded dish photo into a premium Instagram Story ad.

Hard layout rules:
- Canvas: 1080x1920 vertical, optimize for Instagram Story.
- Keep the real dish as the HERO: center or slightly low-center, crisp, sharp, appetizing.
- Subtly "glow up" the dish:
  - Improve lighting and color, add depth and contrast.
  - Slight vignette and shallow depth of field to separate the dish from the background.
- Add a **soft dark gradient overlay** behind all text areas (top and bottom) to guarantee contrast.
- Never put white text directly on busy/unmodified background.

Text layout (all text must be clean, high contrast, and readable at a glance):
- TOP (small, centered): "{businessName}" in all caps, modern sans-serif, white.
- UNDER IT: "NEW MENU ITEM" in slightly smaller tracking-wide text.
- MIDDLE/BOTTOM OVERLAY:
  - Large bold dish name: "{tagline}".
  - Under it: price if provided (e.g., "R185") in medium weight.
  - Under that in smaller text: "{address}" (1–2 lines max).
- CTA at very bottom:
  - Rounded pill button in a single solid brand-like color (gold or deep red).
  - Label: "BOOK A TABLE" or "ORDER NOW" in all caps white text.

Visual style:
- Modern, minimal, cinematic.
- Warm, appetizing tones; avoid oversaturation.
- Plenty of breathing room; respect safe margins (no text touching edges).
- No extra objects, logos, or fake dishes. Use only the provided dish, enhanced.

Output:
- One single finished ad image that follows this layout and contrast guidance exactly.`,
  },
  restaurant_weekend_special: {
    label: "Weekend Special",
    description: "Promote weekend deals and special offers",
    mediaType: "image",
    recommendedAspectRatio: "16:9",
    promptTemplate: `You are a senior brand designer at a top creative agency.

Create a bold, **weekend-only** campaign graphic for {businessName} that feels urgent, appetizing, and premium — not like a generic promo banner.

If an image of the venue or dishes is provided, treat it as a **supporting hero element**: crop, frame, or blend it into the layout. Do **not** just drop text on top of the raw photo.

Goals:

* Drive visits or orders **this weekend**.

* Make the offer feel limited, exciting, and trustworthy.

* Every generation must feel like a fresh campaign concept, not a reused template.

Must include:

* A strong headline for the offer or theme (e.g. "Weekend Feast Special", "2-for-1 Cocktails", "Sunday Roast").

* {businessName}

* {address} (if provided)

* {phone} and/or {website} (if provided)

* A clear call-to-action: "BOOK NOW", "JOIN US THIS WEEKEND", or "RESERVE YOUR TABLE".

* Optionally include "{tagline}" as an anchor phrase if present.

Art direction:

* Format: social-first poster (square or 4:5 vertical). Centered composition, clean hierarchy.

* Use rich food photography or abstract shapes to suggest flavour, nightlife, warmth.

* You may:

  * Overlay gradients

  * Use angled panels, badges, or ribbons for the offer

  * Add subtle grain or glow for depth

* Ensure **excellent contrast** behind all text via solid blocks, gradients, or blur panels.

Typography:

* Avoid default/system font feel.

* Use 2–3 complementary typefaces:

  * A bold, confident display font for the headline.

  * A clean sans-serif for body details.

  * Optional condensed/uppercase for supporting labels ("WEEKEND ONLY", "LIMITED").

* Prioritize quick legibility when thumb-scrolling.

Variation:

* Randomize visual directions:

  * Dark moody bar/nightlife look

  * Bright brunch/sunlit vibe

  * Bold graphic blocks with minimal photography

* No two outputs should look like clones.

Constraints:

* Don't invent fake discounts or info.

* Don't misrepresent the cuisine.

* Output a single finished weekend campaign image.`,
  },
  restaurant_brunch_launch: {
    label: "Brunch Launch",
    description: "Launch a new brunch menu or service",
    mediaType: "image",
    recommendedAspectRatio: "4:5",
    promptTemplate: `You are a senior brand and hospitality designer.

Design a **brunch launch** campaign for {businessName} that feels fresh, social, and aspirational — something that would make people send it to a friend.

If an image is provided (space, dishes, coffee, etc.), integrate it tastefully:

* As a masked hero panel,

* In soft-focus background,

* Or as part of a collage.

  Never just drop plain text over clutter.

Must include:

* A hero headline announcing brunch (e.g. "Weekend Brunch Is Here").

* {businessName}

* Brunch timing details if available (or "This Weekend" vibe from {tagline} when relevant).

* {address} and {phone}/{website} if provided.

* A clear CTA: "BOOK BRUNCH", "RESERVE YOUR TABLE", or similar.

* Use "{tagline}" as a flexible supporting phrase if present.

Art direction:

* Light, airy, inviting.

* Palette: soft neutrals, pastels, warm sunlight tones — can vary by generation.

* Visual cues:

  * Coffee cups, sunny highlights, subtle tableware forms, circles or arches.

  * Overlapping panels, rounded shapes, or frames that feel lifestyle-magazine-worthy.

* Maintain padding and margins; no elements crushed against edges.

Typography:

* Contemporary, editorial-inspired.

* Mix:

  * Elegant serif or refined display for the headline.

  * Clean sans-serif for details.

* Strong typographic rhythm and clear hierarchy.

Variation:

* Alternate between:

  * Minimal white-space-heavy layouts.

  * Photo-driven collage with overlays.

  * Playful shapes and bold colour pops.

* Each generation should explore different compositions.

Constraints:

* Don't fabricate menu items or prices.

* Output one polished brunch launch poster.`,
  },
  
  // Restaurant - Video
  restaurant_new_dish_video: {
    label: "New Dish Video",
    description: "Dynamic video showcasing a new menu item",
    mediaType: "video",
    recommendedAspectRatio: "9:16",
    promptTemplate: `You are a motion designer at a performance creative studio.

Create a **5–7 second vertical video ad** for {businessName} announcing a new menu item: "{tagline}" (dish name or hook).

Use the provided dish image as the anchor frame and build motion around it.

Goals:

* Make the dish feel cinematic and premium.

* Keep it short, thumb-stopping, and platform-ready (Reels/Stories/TikTok).

Direction:

* Aspect: 9:16 vertical.

* Structure:

  1. 0–1s: Quick "NEW MENU ITEM" / "CHEF'S SPECIAL" intro.

  2. 1–4s: Hero focus on the dish (gentle push-in, parallax, or depth).

  3. 4–7s: Overlay {businessName}, {address} (if provided), and CTA ("BOOK A TABLE", "ORDER NOW").

* Motion ideas:

  * Slow camera drift or zoom on the plated dish.

  * Soft light sweeps, depth-of-field shifts, subtle steam or glow.

  * Animated badge or label with "NEW" or "LIMITED".

Style:

* Rich colour, appetizing highlights.

* Clean overlays with high-contrast text areas.

* No cheesy transitions; smooth and refined.

Constraints:

* No voiceover; ambient or implied background only.

* Don't alter the dish into something else.

* Export as a single short ad suitable for social feeds.`,
  },
  
  // Medical - Image
  medical_new_patient_offer: {
    label: "New Patient Offer",
    description: "Attract new patients with special offers",
    mediaType: "image",
    recommendedAspectRatio: "1:1",
    promptTemplate: `**Medical – New Patient Offer (Image Ad)**

You are a senior brand designer for a top cosmetic & medical clinic group.

Create a **distinctive, premium new patient offer ad** for **{businessName}** using the uploaded image as the hero, but transform the frame into a bold, modern campaign visual — not a basic stock banner.

Goals:

* Instantly signal **expert, safe, high-end care**.
* Make the offer feel exciting *and* trustworthy.
* Every output must look like a fresh concept, not a reused template.

Must include:

* Strong hero headline about the offer (e.g. “FREE TEETH WHITENING”, “NEW PATIENT SMILE PACKAGE”).
* {businessName}.
* {tagline} if provided.
* {address}, {phone}, {website} when provided.
* Clear CTA in a designed element: “BOOK NOW”, “CALL TO SCHEDULE”, “SMILE UPGRADE”, etc.

Art Direction:

* Aspect: vertical 1080×1920 style (story/poster format).
* Use the input smile/face as the **central proof of result**, but integrate it into a designed composition:

  * You MAY crop, mask, duotone, or frame the image in geometric shapes, circles, arches, diagonals, or split-screen layouts.
  * You MAY enhance lighting, clarity, and contrast to make teeth and skin look natural but aspirational.
* Add **layered visual structure**:

  * Confident colour blocks or gradient panels (navy, teal, soft white, blush, gold accents).
  * Clean lines, thin dividers, subtle grids, or medical-inspired UI motifs.
  * Optional icons: phone, location pin, calendar, tooth or smile mark — minimal and refined.
* The design should feel **magazine-level** or boutique clinic level, not generic social ad.

Typography (no boring defaults):

* Use a 2–3 font system:

  * Hero: bold, modern sans-serif or classy condensed for the main offer.
  * Secondary: clean humanist sans-serif for details.
  * Optional accent: light condensed or subtle serif for supporting labels.
* Strong hierarchy:

  1. Offer headline (largest).
  2. Supporting promise or subline.
  3. Clinic name.
  4. Contact/location.
  5. CTA inside a **button, ribbon, or badge**.
* Ensure high contrast and legibility:

  * Place text on solid/blurred/gradient areas, not directly on busy image regions.

Variation Rules (to guarantee uniqueness):

* For each generation, **choose and fully commit to one direction**, such as:

  * Luxe navy + gold with architectural shapes.
  * Minimal white + teal with asymmetric layout.
  * Soft gradient glow with circular crop of the smile.
  * Bold split-screen: half portrait, half deep colour with giant typography.
* Randomize:

  * Colour palette within medical-safe range.
  * Shape language (circles, diagonals, arches, modular cards).
  * CTA treatment (pill button, corner flag, seal, sidebar block).
  * Badge styles (e.g. “NEW”, “LIMITED”, “WELCOME OFFER”).
* Never reuse the exact same layout, spacing, or combination twice.

Constraints:

* Keep the look honest and tasteful: no fake clinical claims or extreme retouching.
* Do **not** add graphic surgery imagery or anything unsettling.
* Do not fabricate prices or details not provided.
* Output **one** finished, high-resolution ad image in this style.`,
  },
  medical_appointment_reminder: {
    label: "Appointment Reminder",
    description: "Remind patients to book appointments",
    mediaType: "image",
    recommendedAspectRatio: "16:9",
    promptTemplate: `You are a healthcare lifecycle marketing designer.

Design a **friendly appointment reminder ad** for {businessName} that nudges patients to book — calm, organized, reliable.

Must include:

* Headline like "Time for your check-up?" / "Don't delay your health".

* {businessName}

* {phone} and/or {website} for booking.

* {address} (if provided).

* Optional: "{tagline}" as reassurance ("Trusted since…", "Family care", etc.).

* A CTA: "BOOK YOUR APPOINTMENT".

Art direction:

* Simple, uncluttered.

* Palette: soft medical tones; emphasis on clarity.

* Use subtle calendar/clock motifs, icons, or minimal illustrations.

* If image is provided, integrate as soft-focus background or framed panel.

* Always maintain excellent contrast for text.

Typography:

* Straightforward, modern sans-serif.

* Strong emphasis on the reminder line + CTA.

* Layout must survive small-screen viewing.

Variation:

* Change composition, accent colours, and iconography between generations.

Constraints:

* No fear-based messaging.

* One ready-to-post reminder visual.`,
  },
  
  // Medical - Video
  medical_new_patient_video: {
    label: "New Patient Video",
    description: "Video ad for new patient acquisition",
    mediaType: "video",
    recommendedAspectRatio: "9:16",
    promptTemplate: `You are a medical brand motion designer.

Create a **5–7 second vertical video** introducing {businessName} to new patients.

Goals:

* Convey safety, professionalism, and warmth quickly.

* Drive viewers to book.

Structure:

1. Soft intro: "New here?" or "Looking for a trusted {tagline or specialty}?".

2. Show welcoming environment / staff (use provided imagery as parallax layers or framed shots).

3. Close with {businessName}, {address}, {phone}/{website}, and CTA ("BOOK TODAY").

Art direction:

* 9:16 vertical.

* Gentle camera moves, fades, and parallax.

* Soft gradients and clean overlays; no harsh effects.

Constraints:

* No graphic procedures.

* No medical claims that aren't in the input.

* Deliver one clean short awareness video.`,
  },
  
  // Automotive - Image
  auto_free_diagnostics: {
    label: "Free Diagnostics",
    description: "Promote free diagnostic services",
    mediaType: "image",
    recommendedAspectRatio: "1:1",
    promptTemplate: `You are a senior brand designer for performance-driven automotive campaigns.

Create a **bold, scroll-stopping ad** promoting a free diagnostics offer for **{businessName}**.

Use the uploaded workshop/vehicle image as a key element, but **rebuild** the scene into a premium graphic — not just text on top of the raw photo.

**Goals**

* Make {businessName} look expert, reliable, and energetic.
* Communicate “Free Diagnostics” in under 1 second.
* Every generation must feel **distinct** (no cookie-cutter layouts).

**Must include**

* Hero headline around the offer (e.g. **“FREE CAR DIAGNOSTIC CHECK”**).
* {businessName}.
* {tagline} if provided (e.g. “Trusted Since 1998”, “Specialists in German Vehicles”).
* {address}, {phone}, {website} where provided.
* Clear CTA: “BOOK NOW”, “CALL TO BOOK”, “CHECK MY CAR”, or similar in a button or badge.

**Art Direction**

* Canvas: square 1080×1080 (or equivalent) optimized for social feeds.
* Treat this as a **poster layout**:

  * You MAY crop, tilt, or frame the input image inside panels/shapes.
  * Keep a clear focus on mechanic/engine/vehicle to signal expertise.
* Use **layered UI**:

  * Strong colour blocks or angled bands.
  * Subtle tech/engineering motifs (lines, grids, icons, diagnostics scan elements).
  * Depth via shadows, overlays, and framing.

**Style**

* Confident, urban, technical.
* Prefer deep navy, charcoal, gunmetal, with one strong accent (electric blue, neon lime, bright orange, etc.).
* High contrast between text and background. No flat, muddy, low-contrast look.
* Avoid looking cheap or spammy; it should feel like a pro service centre or performance garage.

**Typography**

* No default system-font aesthetic.
* Use 2–3 contrasting type styles:

  * Heavy condensed sans-serif or display font for the main offer.
  * Clean geometric sans-serif for details.
  * Optional narrow/mono style for techy labels or “FREE” tags.
* Strong hierarchy:

  1. Offer (largest: “FREE DIAGNOSTIC”)
  2. Supporting line (what’s included / why it matters)
  3. Brand + contact details
  4. CTA in a solid, clearly clickable button or badge.

**Variation (important)**

For different runs, vary **layout and personality**:

* One version: diagonal split with photo on one side, bold colour block on the other.
* One version: dark, moody garage look with neon accent lines and scan-style HUD graphics.
* One version: bright, clean service bay with stacked cards for benefits.
* One version: dynamic crop of engine parts with big vertical or rotated type.

Never repeat the same exact composition, shapes, or palette.

**Constraints**

* Do not fabricate prices, logos, or brands.
* Do not show dangerous or unsafe workshop practices.
* Output one finished static ad image that follows the above.`,
  },
  auto_service_special: {
    label: "Service Special",
    description: "Promote seasonal service specials",
    mediaType: "image",
    recommendedAspectRatio: "16:9",
    promptTemplate: `You are a senior designer for automotive brands.

Design a **service special** promo for {businessName} that feels premium workshop, not bargain basement.

Must include:

* Headline centred on the specific offer or {tagline}.

* {businessName}

* {address}, {phone}, {website} if available.

* Clear CTA: "BOOK A SERVICE", "GET A QUOTE", etc.

Art direction:

* Strong contrast, bold lines.

* Use photography or abstract mechanical motifs (tyres, engine patterns, grids).

* Consider split layouts: car visual on one side, clean offer panel on the other.

* Maintain visual order and legibility.

Typography:

* Confident, technical-inspired headline font.

* Simple sans-serif body.

Variation:

* Explore light vs dark themes, different layouts, and shape systems.

Constraints:

* No misleading manufacturer logos.

* One export-ready ad.`,
  },
  
  // Automotive - Video
  auto_service_video: {
    label: "Service Video",
    description: "Video showcasing automotive services",
    mediaType: "video",
    recommendedAspectRatio: "16:9",
    promptTemplate: `You are a motion designer for automotive service campaigns.

Create a **5–7 second landscape or vertical video** showcasing services of {businessName}.

Structure:

1. Quick hook: "Keep your car running right" / {tagline}.

2. Visuals: workshop, tools, cars (animated from stills, parallax, light sweeps).

3. Overlay {businessName}, key services, {address}, {phone}, CTA ("BOOK YOUR SERVICE").

Art direction:

* Dynamic camera moves, light streaks, motion lines.

* High-contrast colour accents in brand-like tones.

* Clean layout; no chaotic overlays.

Constraints:

* Don't promise warranties not provided.

* One concise service spot.`,
  },
  
  // Health & Fitness - Image
  fitness_new_member: {
    label: "New Member Special",
    description: "Attract new gym members",
    mediaType: "image",
    recommendedAspectRatio: "4:5",
    promptTemplate: `### Health & Fitness — New Member Offer (New Members, Challenges, Promotions)

You are a senior brand designer for high-growth fitness brands.

Create a **unique, high-energy ad** for {businessName} promoting a new member offer or headline promo.

Use the uploaded gym/fitness image as the **hero environment**, but transform the layout into a bold campaign visual — not just text over the raw photo.

**Goals**

* Make people feel: *“This is where serious results happen.”*
* Look premium, modern, and legit (not cheap flyer vibes).
* Every generation must feel different — no rigid template reuse.

**Must include**

* A punchy offer headline (e.g. “50% OFF NEW MEMBERS”, “JOIN 30-DAY SHRED”, “NO JOINING FEE”).
* {businessName}
* {tagline} if provided (e.g. “Strength Club”, “24/7 Performance Gym”).
* {address}, {phone}, {website} where provided.
* A clear CTA such as **“JOIN NOW”**, **“START TODAY”**, or **“CLAIM YOUR PASS”**.

**Art Direction**

* Canvas: vertical poster-style (1080x1920 or similar) optimised for Instagram Story / social.
* Treat this as a **full campaign layout**:

  * You MAY crop, tilt, zoom, or mask the input photo.
  * Use it as backdrop or in a strong panel, keeping equipment/people visible and aspirational.
* Design elements:

  * Strong diagonals, bars, or grids echoing racks, plates, or track lanes.
  * Energetic glow lines, motion streaks, or subtle grain for intensity.
  * Depth: overlays, gradients, blurred background zones for text.

**Palette**

* Confident, high-contrast palettes:

  * e.g. charcoal + electric lime; deep navy + neon cyan; black + hot red; or bold duotones.
* Avoid flat grey, washed-out, or generic corporate blue-only looks.

**Typography**

* Absolutely **no** basic system-font look.
* Use 2–3 complementary typefaces:

  * Hero: bold condensed or wide display for the OFFER.
  * Secondary: clean sans-serif for benefits and details.
  * Optional accent: narrow or italic for “NEW”, “LIMITED”, etc.
* Hierarchy:

  1. Offer (dominant, impossible to miss).
  2. Supporting benefit/descriptor.
  3. Brand name.
  4. Location & contact.
  5. CTA in a solid, clearly tappable button or badge.
* Always place text on solid, blurred, or gradient surfaces; never floating on busy background.

**Variation (Important)**

For each generation, **choose one direction and commit**:

* High-contrast black + neon kinetic layout with angled blocks.
* Minimal luxe: monochrome gym shot with one bold accent colour band.
* Split-screen: gym environment + bold colour field with typography.
* Ticket/pass style: card or badge motif for “Free Pass” / “Offer”.

Randomize:

* Colour palettes,
* Shape language,
* Type combinations,
* Layout structure.

So repeated runs **do not** look like the same template.

**Constraints**

* Do not fabricate prices, durations, or guarantees not provided.
* Do not add unrealistic body imagery; keep it aspirational but believable.
* Output **one** finished static ad image following these rules.`,
  },
  
  // Legal - Image
  legal_consultation: {
    label: "Free Consultation",
    description: "Promote free legal consultations",
    mediaType: "image",
    recommendedAspectRatio: "1:1",
    promptTemplate: `You are a senior legal-brand designer.

Create a **professional, authoritative ad** for {businessName} offering a free or introductory consultation.

Must include:

* Headline: "Free Consultation", "Talk To Us First", or similar.

* {businessName}

* {tagline} if provided (practice area / positioning).

* {address}, {phone}, {website} where available.

* CTA: "BOOK A CONSULTATION" or "CONTACT US TODAY".

Art direction:

* Clean, confident, understated.

* Palette: navy, charcoal, deep green, or burgundy with subtle highlights.

* Imagery:

  * If an image is provided, integrate as tasteful office/justice motif.

  * Otherwise use abstract shapes, columns, scales, or structured grids.

* Emphasize trust, clarity, and discretion.

Typography:

* Mix of refined serif (for headline) and modern sans-serif (for details).

* Clear hierarchy; no clutter.

Variation:

* Different compositions: badge-focused, vertical ribbon, minimal white-space.

Constraints:

* Don't imply specific legal outcomes or guarantees.

* One polished visual.`,
  },
  
  // Generic - Image
  generic_promotion: {
    label: "General Promotion",
    description: "Flexible ad template for any promotion",
    mediaType: "image",
    recommendedAspectRatio: "1:1",
    promptTemplate: `You are a senior full-stack brand designer.

Create a **flexible promotional ad** for {businessName} in the {category} space, based on the supplied details.

Must include:

* A strong headline based on {tagline} or the core offer.

* {businessName}

* {address}, {phone}, {website} when provided.

* Clear CTA relevant to the context (BOOK, SHOP, VISIT, CALL, SIGN UP, etc.).

Art direction:

* Style should adapt to {category}:

  * Restaurant → appetizing, rich, inviting.

  * Medical → clean, calm, trustworthy.

  * Automotive → bold, technical.

  * Fitness → energetic.

  * Legal → refined.

  * Other → modern and brandable.

* Use provided image if available; otherwise create visuals that align with the category.

* Use layered shapes, gradients, and thoughtful composition — no generic flat banner.

Typography:

* 2–3 complementary fonts with clear hierarchy.

* Distinctive headline treatment; not generic system font.

Variation:

* Encourage different layouts, palettes, and compositions between runs.

* Avoid rigid templates.

Constraints:

* No made-up claims.

* One finished promo image.`,
  },
  
  // Generic - Video
  generic_promotion_video: {
    label: "General Promotion Video",
    description: "Flexible video ad template",
    mediaType: "video",
    recommendedAspectRatio: "9:16",
    promptTemplate: `You are a senior motion designer building **versatile short-form ads**.

Create a **5–7 second vertical video** promoting {businessName} and its key message: {tagline}.

Must include:

* {businessName}

* {tagline} or distilled value prop.

* {address} and {phone}/{website} if available.

* Clear CTA (BOOK, SHOP, VISIT, CONTACT, etc.).

Direction:

* 9:16 vertical.

* Use visuals that match {category} (see above mapping).

* Structure:

  1. Hook with {tagline} or key promise.

  2. Visuals: animated from stills, icons, or abstract forms.

  3. End frame with logo/name + CTA.

Style:

* Smooth, modern transitions.

* Strong colour & type system aligned to category.

* High contrast; text always readable.

Variation:

* Explore different motion patterns, palettes, and compositions.

Constraints:

* Don't add specific offers not provided.

* Deliver one concise, export-ready promo video.`,
  },
};

/**
 * Get presets by category and media type
 */
export function getPresetsByCategoryAndType(
  category: string,
  mediaType: "image" | "video"
): AdPreset[] {
  return Object.entries(AD_PRESETS)
    .filter(([_, preset]) => {
      const matchesCategory = preset.label.toLowerCase().includes(category.toLowerCase()) ||
        category === "other" ||
        (category === "restaurant" && preset.label.toLowerCase().includes("restaurant")) ||
        (category === "medical" && preset.label.toLowerCase().includes("medical")) ||
        (category === "automotive" && (preset.label.toLowerCase().includes("auto") || preset.label.toLowerCase().includes("car"))) ||
        (category === "health" && preset.label.toLowerCase().includes("fitness")) ||
        (category === "legal" && preset.label.toLowerCase().includes("legal"));
      return matchesCategory && preset.mediaType === mediaType;
    })
    .map(([_, preset]) => preset);
}

/**
 * Get preset by key
 */
export function getPresetByKey(key: string): AdPreset | undefined {
  return AD_PRESETS[key];
}

/**
 * Get all categories
 */
export const AD_CATEGORIES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "medical", label: "Medical" },
  { value: "automotive", label: "Automotive" },
  { value: "health", label: "Health & Fitness" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
] as const;


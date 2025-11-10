/**
 * Prompt builders for OpenAI image ad generation
 */

export interface PromptParams {
  businessName: string;
  tagline: string;
  address?: string;
  phone?: string;
  category?: string;
}

/**
 * Build prompt for restaurant new dish preset
 */
export function buildRestaurantNewDishPrompt(params: PromptParams): string {
  const { businessName, tagline, address, phone } = params;
  
  let prompt = `You are a senior brand designer at a top creative agency.

Create a UNIQUE, high-impact Instagram Story ad announcing a new menu item for ${businessName}.

Use the uploaded dish image as the hero element, but transform the overall visual into a polished, colourful, modern campaign graphic.

Goals:
- Make people instantly crave the dish.
- Make the restaurant look premium, confident, and distinctive.
- Every generation must look different: no rigid templates.

Must include:
- Dish name as a bold hero title: "${tagline}"
- Optional small line like "New menu item" or "Chef's special"
- ${businessName}`;

  if (address) {
    prompt += `\n- ${address}`;
  }

  if (phone) {
    prompt += `\n- ${phone}`;
  }

  prompt += `\n- A clear call-to-action such as "BOOK A TABLE", "VISIT US", or "ORDER NOW"

Art direction:
- Canvas: vertical 1080x1920 style (use that aspect or similar), optimized for Instagram Story.
- Treat this as a full poster, not just text on top of the raw photo.
- You MAY crop, mask or frame the input dish image inside shapes or panels.
- You MUST keep the dish clearly visible and appetizing.

Style:
- Use rich, appetizing colour palettes. Avoid flat, dull or washed-out looks.
- Add multiple design elements:
  - bold colour blocks or gradient bands
  - dynamic shapes, diagonals, frames, or outlines around the dish
  - subtle textures, glows, or depth-of-field to add depth
  - optional "NEW" / "LIMITED" style badges
- Elevate the dish: you may slightly enhance lighting, contrast and clarity, add gentle glow or spotlight, but do not change the dish into something else.

Typography:
- No generic system-font look.
- Use 2–3 complementary fonts:
  - Hero: expressive display type for the dish name.
  - Secondary: clean sans-serif for body and details.
  - Optional accent: condensed or script for emphasis.
- Strong hierarchy:
  1. Dish name (largest)
  2. Supporting line
  3. Restaurant + details
  4. CTA in a button or badge
- Ensure high contrast and readability:
  - Always place text on solid/blurred/gradient areas or colour panels.
  - Never leave white text floating over busy parts of the photo.

Variation (important):
- For each generation, choose one direction based on the dish and vary:
  - A vibrant geometric layout
  - A dark, moody neon-accent look
  - A minimal luxe composition with one strong accent colour
  - A playful collage with stickers/arrows pointing to the dish
- Randomize palette, shape language, label styles, and layout so that different runs do NOT look like copies.

Constraints:
- Do not fabricate prices or details not provided.
- Do not add extra dishes or ingredients that misrepresent the photo.
- Output a single finished ad image as described.`;

  return prompt;
}

/**
 * Build prompt based on preset key
 */
export function buildImageAdPrompt(
  preset: string,
  params: PromptParams
): string {
  switch (preset) {
    case "restaurant-new-dish":
    case "restaurant_new_dish":
      return buildRestaurantNewDishPrompt(params);
    
    // Add more preset prompts here as needed
    default:
      // Fallback generic prompt
      return `Create a professional promotional ad for ${params.businessName}. Include the promotion details: "${params.tagline}". ${params.address ? `Location: ${params.address}.` : ""} ${params.phone ? `Phone: ${params.phone}.` : ""} Style: modern, professional, engaging.`;
  }
}



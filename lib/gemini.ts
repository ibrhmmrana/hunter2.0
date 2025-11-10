/**
 * Google Gemini API client for AI ad generation (Imagen & Veo)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Singleton Gemini client
let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

export interface BusinessDetails {
  name: string;
  tagline?: string;
  phone?: string;
  website?: string;
  address?: string;
  category?: string;
}

export interface AdPreset {
  label: string;
  description: string;
  mediaType: "image" | "video";
  recommendedAspectRatio: string;
  promptTemplate: string;
}

/**
 * Generate an ad image using Gemini Imagen
 */
export async function generateAdImage(
  preset: AdPreset,
  business: BusinessDetails,
  imageBytesOrUrl?: string | Uint8Array
): Promise<{ imageUrl: string; imageBytes?: Uint8Array }> {
  const client = getGeminiClient();
  
  // Build prompt from template
  const prompt = buildPrompt(preset.promptTemplate, business, preset);
  
  try {
    // Use gemini-2.0-flash-exp for image generation with image input
    const model = client.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
    });

    // Prepare content parts
    const parts: any[] = [{ text: prompt }];
    
    // If image is provided, add it as input
    if (imageBytesOrUrl) {
      if (typeof imageBytesOrUrl === "string") {
        // URL - fetch and convert to base64
        const imageResponse = await fetch(imageBytesOrUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString("base64");
        const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
        
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType,
          },
        });
      } else {
        // Uint8Array - convert to base64
        const imageBase64 = Buffer.from(imageBytesOrUrl).toString("base64");
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
          },
        });
      }
    }

    // Generate image
    // Note: Gemini 2.0 Flash Experimental supports image generation via multimodal prompts
    // For pure image generation, we may need to use a different approach
    // For now, we'll use the text-to-image capabilities
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const response = await result.response;
    
    // Check if response contains images
    // Gemini may return text describing the image, or actual image data
    // For production, you may need to use Imagen API directly via REST
    // This is a placeholder implementation
    
    // For now, return a placeholder - in production, extract actual image from response
    // or use Google's Imagen REST API directly
    throw new Error("Image generation via Gemini client needs Imagen REST API integration");
    
  } catch (error: any) {
    console.error("[gemini] Image generation error:", error);
    throw new Error(`Failed to generate ad image: ${error.message}`);
  }
}

/**
 * Generate an ad video using Veo
 */
export async function generateAdVideo(
  preset: AdPreset,
  business: BusinessDetails,
  imageBytesOrUrl?: string | Uint8Array
): Promise<{ videoUrl: string }> {
  const client = getGeminiClient();
  
  // Build prompt
  const prompt = buildPrompt(preset.promptTemplate, business, preset);
  
  try {
    // Veo video generation
    // Note: Veo may require REST API calls rather than the JS client
    // This is a placeholder - actual implementation depends on Veo API availability
    
    // For video generation, we typically need:
    // 1. Generate a base image if not provided
    // 2. Use Veo to create video from image + prompt
    // 3. Poll for completion
    
    let baseImageUrl: string | undefined;
    
    if (!imageBytesOrUrl) {
      // Generate base image first
      const imageResult = await generateAdImage(preset, business);
      baseImageUrl = imageResult.imageUrl;
    } else if (typeof imageBytesOrUrl === "string") {
      baseImageUrl = imageBytesOrUrl;
    } else {
      // Convert bytes to URL (upload to storage first)
      throw new Error("Image bytes need to be uploaded to storage first");
    }
    
    // Veo video generation would go here
    // This requires REST API integration with Google's Veo service
    throw new Error("Video generation via Veo requires REST API integration");
    
  } catch (error: any) {
    console.error("[gemini] Video generation error:", error);
    throw new Error(`Failed to generate ad video: ${error.message}`);
  }
}

/**
 * Build prompt from template
 */
function buildPrompt(
  template: string,
  business: BusinessDetails,
  preset: AdPreset
): string {
  let prompt = template
    .replace(/\{businessName\}/g, business.name)
    .replace(/\{tagline\}/g, business.tagline || "")
    .replace(/\{phone\}/g, business.phone || "")
    .replace(/\{website\}/g, business.website || "")
    .replace(/\{address\}/g, business.address || "")
    .replace(/\{category\}/g, business.category || "");
  
  // Add aspect ratio guidance
  if (preset.recommendedAspectRatio) {
    prompt += ` Aspect ratio: ${preset.recommendedAspectRatio}.`;
  }
  
  return prompt;
}

/**
 * Generate image using Gemini Nano Banana (gemini-2.5-flash-image)
 * Supports both text-to-image and text-and-image-to-image (editing)
 */
export async function generateAdImageViaImagen(
  preset: AdPreset,
  business: BusinessDetails,
  imageBytesOrUrl?: string | Uint8Array
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  
  const prompt = buildPrompt(preset.promptTemplate, business, preset);
  
  // Use Gemini Nano Banana API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
  
  // Build parts array - image first, then text (as per Gemini docs)
  const parts: any[] = [];
  
  // If image is provided, add it as inline_data for image editing
  if (imageBytesOrUrl) {
    let imageBase64: string;
    let mimeType = "image/jpeg";
    
    if (typeof imageBytesOrUrl === "string") {
      // If it's a data URL, extract ONLY the base64 part (strip "data:image/jpeg;base64,")
      if (imageBytesOrUrl.startsWith("data:")) {
        const dataUrlParts = imageBytesOrUrl.split(",");
        if (dataUrlParts.length >= 2) {
          const header = dataUrlParts[0];
          // Extract base64 - everything after "base64,"
          imageBase64 = dataUrlParts.slice(1).join(",");
          
          // Extract mime type from header (e.g., "data:image/jpeg" -> "image/jpeg")
          const mimeMatch = header.match(/data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          console.log("[gemini] Extracted base64 from data URL, mime type:", mimeType, "base64 length:", imageBase64.length);
        } else {
          throw new Error("Invalid data URL format");
        }
      } else {
        // It's a URL, fetch it
        console.log("[gemini] Fetching image from URL:", imageBytesOrUrl);
        const imageResponse = await fetch(imageBytesOrUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        imageBase64 = Buffer.from(imageBuffer).toString("base64");
        mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
        console.log("[gemini] Fetched image, converted to base64, length:", imageBase64.length);
      }
    } else {
      // Uint8Array - convert to base64
      imageBase64 = Buffer.from(imageBytesOrUrl).toString("base64");
      console.log("[gemini] Converted Uint8Array to base64, length:", imageBase64.length);
    }
    
    // Add image part FIRST (Gemini expects image before text for editing)
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64, // Raw base64, no "data:" prefix
      },
    });
    console.log("[gemini] Added image to parts array (raw base64, no data: prefix)");
  }
  
  // Add text prompt
  parts.push({ text: prompt });
  
  const requestBody = {
    contents: [{
      parts: parts,
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };
  
  try {
    console.log("[gemini] Making request to Gemini API...");
    console.log("[gemini] Model: gemini-2.5-flash-image");
    console.log("[gemini] URL:", url.replace(apiKey, "***"));
    console.log("[gemini] Request body parts count:", parts.length);
    console.log("[gemini] Has image:", !!imageBytesOrUrl);
    console.log("[gemini] Prompt length:", prompt.length);
    console.log("[gemini] Generation config:", JSON.stringify(requestBody.generationConfig));
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Note: API key is in URL query param, not header
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log("[gemini] Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[gemini] API error response:", errorText);
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log("[gemini] Response received");
    console.log("[gemini] Has candidates:", !!result.candidates);
    console.log("[gemini] Candidates count:", result.candidates?.length || 0);
    
    // Check for errors in response
    if (result.error) {
      console.error("[gemini] API returned error:", result.error);
      throw new Error(`Gemini API error: ${result.error.message || JSON.stringify(result.error)}`);
    }
    
    // Parse response: candidates[0].content.parts[*].inlineData or inline_data
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      console.log("[gemini] Candidate found:", {
        finishReason: candidate.finishReason,
        contentParts: candidate.content?.parts?.length || 0,
      });
      
      // Check for safety ratings or blocked content
      if (candidate.safetyRatings) {
        console.log("[gemini] Safety ratings:", candidate.safetyRatings);
        const blocked = candidate.safetyRatings.some((rating: any) => 
          rating.category === "HARM_CATEGORY_DANGEROUS_CONTENT" && 
          (rating.probability === "HIGH" || rating.probability === "MEDIUM")
        );
        if (blocked) {
          throw new Error("Content was blocked by safety filters. Please try a different prompt.");
        }
      }
      
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        console.warn("[gemini] Finish reason:", candidate.finishReason);
        if (candidate.finishReason === "SAFETY") {
          throw new Error("Content was blocked by safety filters. Please try a different prompt.");
        }
        if (candidate.finishReason === "RECITATION") {
          throw new Error("Content was blocked due to potential copyright issues. Please try a different prompt.");
        }
      }
      
      if (candidate.content && candidate.content.parts) {
        console.log("[gemini] Processing", candidate.content.parts.length, "parts");
        for (let i = 0; i < candidate.content.parts.length; i++) {
          const part = candidate.content.parts[i];
          console.log(`[gemini] Part ${i} keys:`, Object.keys(part));
          
          // Check for inlineData (camelCase) - Gemini API may return this
          if (part.inlineData && part.inlineData.data) {
            const base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || "image/png";
            console.log("[gemini] Image data found in inlineData (camelCase), size:", base64Data.length, "bytes, mime:", mimeType);
            return { imageUrl: `data:${mimeType};base64,${base64Data}` };
          }
          
          // Check for inline_data (snake_case) - alternative format
          if (part.inline_data && part.inline_data.data) {
            const base64Data = part.inline_data.data;
            const mimeType = part.inline_data.mime_type || "image/png";
            console.log("[gemini] Image data found in inline_data (snake_case), size:", base64Data.length, "bytes, mime:", mimeType);
            return { imageUrl: `data:${mimeType};base64,${base64Data}` };
          }
          
          // Also check for text responses that might indicate an error
          if (part.text) {
            console.log("[gemini] Text response in part:", part.text.substring(0, 200));
            // Sometimes the API returns text explaining why it can't generate an image
            if (part.text.toLowerCase().includes("cannot") || part.text.toLowerCase().includes("unable")) {
              throw new Error(`Gemini API returned: ${part.text}`);
            }
          }
        }
      }
      
      // If no image data found, log the full structure for debugging
      console.error("[gemini] No image data found in any part.");
      console.error("[gemini] Full candidate structure:", JSON.stringify(candidate, null, 2));
    } else {
      console.error("[gemini] No candidates in response.");
      console.error("[gemini] Full response:", JSON.stringify(result, null, 2));
    }
    
    throw new Error(`No image data found in response from gemini-2.5-flash-image. responseModalities was set to ["IMAGE"]. Check server logs for full response structure.`);
  } catch (error: any) {
    console.error("[gemini] Image generation error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      model: "gemini-2.5-flash-image",
    });
    throw new Error(`Failed to generate ad image: ${error.message}`);
  }
}


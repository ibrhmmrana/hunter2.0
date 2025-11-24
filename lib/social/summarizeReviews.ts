import { openai } from "@/lib/openaiClient";

/**
 * Summarize reviews using OpenAI
 * @param reviews Array of review objects with text and stars
 * @param reviewType 'negative' for 1-2 star reviews, 'positive' for 4-5 star reviews
 * @returns Summary sentence
 */
export async function summarizeReviews(
  reviews: Array<{ text?: string; reviewText?: string; stars?: number }>,
  reviewType: 'negative' | 'positive',
  totalCount?: number
): Promise<string | null> {
  if (!reviews || reviews.length === 0) {
    return null;
  }

  // Extract review texts, filtering out empty ones
  // Apify reviews may use: text, reviewText, textReview, description, comment
  const reviewTexts = reviews
    .map((review: any) => {
      return review.text || 
             review.reviewText || 
             review.textReview || 
             review.description || 
             review.comment || 
             review.review || 
             '';
    })
    .filter((text) => text.trim().length > 0);

  if (reviewTexts.length === 0) {
    return null;
  }

  const reviewCount = totalCount || reviewTexts.length;
  const reviewsText = reviewTexts.join('\n\n');

  const prompt = reviewType === 'negative'
    ? `You are analyzing ${reviewCount} negative customer reviews (1-2 stars) for a business. Summarize the most common problem or complaint mentioned across all these reviews in ONE brief sentence. Start your response with "${reviewCount} negative reviews say: " and then provide the summary.

Reviews:
${reviewsText}

Response format: "${reviewCount} negative reviews say: [your summary here]"`

    : `You are analyzing ${reviewCount} positive customer reviews (4-5 stars) for a business. Summarize what customers love most about this business in ONE brief sentence. Start your response with "${reviewCount} positive reviews say: " and then provide the summary.

Reviews:
${reviewsText}

Response format: "${reviewCount} positive reviews say: [your summary here]"`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes customer reviews concisely.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    
    if (!summary) {
      console.error('[summarizeReviews] No summary returned from OpenAI');
      return null;
    }

    console.log(`[summarizeReviews] Generated ${reviewType} summary`, {
      reviewCount,
      summaryLength: summary.length,
    });

    return summary;
  } catch (error: any) {
    console.error(`[summarizeReviews] Error summarizing ${reviewType} reviews:`, {
      error: error.message,
      reviewCount,
    });
    return null;
  }
}


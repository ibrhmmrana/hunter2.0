/**
 * AI-powered discovery query generation for business competitor search.
 * 
 * This module generates realistic Google search phrases that locals might use
 * to discover businesses similar to the target business.
 * 
 * Server-side only - uses OpenAI API.
 */

import { getAnchorCategoryTokens } from '@/lib/competitors/matchCategory';

interface GenerateDiscoveryQueriesInput {
  name: string | null;
  category?: string | null;
  address?: string | null; // Full formatted address from Google Places
  primary_category?: string | null;
}

interface BusinessRow {
  name: string | null;
  category?: string | null;
  primary_category?: string | null;
  address?: string | null;
  city?: string | null;
  neighborhood?: string | null;
}

// Simple in-memory cache to prevent duplicate OpenAI calls for the same business
const discoveryQueriesCache = new Map<string, { queries: string[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

function getCacheKey(input: GenerateDiscoveryQueriesInput): string {
  return `${input.name || ''}|${input.category || ''}|${input.primary_category || ''}|${input.address || ''}`;
}

/**
 * Generate 3-5 short, realistic Google search phrases for discovering similar businesses.
 * 
 * @param input Business information (name, category, location)
 * @returns Array of search phrases, or empty array on failure
 */
export async function generateDiscoveryQueriesForBusiness(
  input: GenerateDiscoveryQueriesInput
): Promise<string[]> {
  // Check cache first
  const cacheKey = getCacheKey(input);
  const cached = discoveryQueriesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[discoveryQueries] ✅ Returning cached queries', {
      cacheKey,
      queryCount: cached.queries.length,
      queries: cached.queries,
      source: 'cache',
    });
    return cached.queries;
  }
  
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY not configured');
    console.error('[discoveryQueries] OPENAI_API_KEY not configured');
    throw error;
  }

  try {
    const systemPrompt = `You are generating realistic Google search phrases that a local person might type to discover businesses similar to the given business.

Rules:
- Generate 4-6 short search phrases (not full sentences)
- Use natural, conversational language
- Extract relevant location information from the full address (neighborhood, suburb, city)
- Include category/cuisine type when available
- Use intent terms like "best", "near me", "open now" where natural
- Keep phrases concise (2-5 words typically)
- No brand names or slogans
- No explanations or meta-commentary

Examples of good phrases:
- "steakhouse rosebank johannesburg"
- "romantic dinner rosebank"
- "best date night restaurant near me"
- "italian restaurant open now"
- "coffee shop melrose"

For a thai restaurant at an address like "70 Millar St, Sophiatown, Randburg, 2092, South Africa", extract the neighborhood "Sophiatown" and create phrases like:
- "thai restaurant sophiatown"
- "noodles sophiatown"
- "dumplings sophiatown"

Return ONLY a JSON array of strings, nothing else.`;

    const primaryCategory = input.primary_category || input.category || null;

    const userPrompt = `Business name: ${input.name || 'N/A'}
${primaryCategory ? `Primary category: ${primaryCategory}` : ''}
${input.category && input.category !== primaryCategory ? `Category: ${input.category}` : ''}
${input.address ? `Address: ${input.address}` : ''}

Generate search phrases:`;

    console.log('[discoveryQueries] Calling OpenAI API', {
      hasApiKey: !!apiKey,
      model: 'gpt-4o-mini',
      inputName: input.name,
      inputCategory: input.category,
      hasAddress: !!input.address,
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fixed: gpt-5-mini doesn't exist, use gpt-4o-mini
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[discoveryQueries] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    console.log('[discoveryQueries] OpenAI response received', {
      hasContent: !!content,
      contentLength: content?.length || 0,
      fullContent: content, // Log the full content to see what we're getting
      rawResponse: JSON.stringify(data, null, 2), // Log the full response structure
    });

    if (!content) {
      console.error('[discoveryQueries] No content in OpenAI response');
      throw new Error('OpenAI returned empty response');
    }

    // Try to parse JSON array from response
    let parsedQueries: string[] | null = null;
    
    try {
      // Remove markdown code blocks if present
      let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to find JSON array in the content
      // Sometimes OpenAI wraps it in text, so look for array pattern
      const jsonArrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        cleaned = jsonArrayMatch[0];
      }
      
      const parsed = JSON.parse(cleaned);
      
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        parsedQueries = parsed;
        console.log('[discoveryQueries] ✅ Successfully parsed OpenAI response as JSON array', {
          count: parsedQueries.length,
          queries: parsedQueries,
          source: 'openai-json',
        });
      } else {
        console.warn('[discoveryQueries] Parsed response is not a string array', {
          type: typeof parsed,
          isArray: Array.isArray(parsed),
          parsedValue: parsed,
        });
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract phrases from text
      console.warn('[discoveryQueries] Failed to parse OpenAI response as JSON, attempting text extraction', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        contentPreview: content.substring(0, 500),
      });
      
      // Try to extract list items from text
      const lines = content.split('\n').map((line: string) => line.trim()).filter(Boolean);
      const phrases = lines
        .map((line: string) => {
          // Remove list markers, quotes, and array brackets
          return line
            .replace(/^[-*•\d+\.]\s*/, '') // Remove list markers
            .replace(/^["'`]|["'`]$/g, '') // Remove quotes
            .replace(/^\[|\]$/g, '') // Remove array brackets
            .trim();
        })
        .filter((phrase: string) => {
          // Filter out empty strings, too long phrases, and non-query text
          return phrase.length > 0 && 
                 phrase.length < 100 && 
                 !phrase.toLowerCase().includes('example') &&
                 !phrase.toLowerCase().includes('here are');
        })
        .slice(0, 6);
      
      if (phrases.length > 0) {
        parsedQueries = phrases;
        console.log('[discoveryQueries] ✅ Extracted phrases from text response', {
          count: phrases.length,
          queries: phrases,
          source: 'openai-text-extraction',
        });
      }
    }

    // If we successfully parsed queries from OpenAI, use them
    if (parsedQueries && parsedQueries.length > 0) {
      // Post-filter queries to match the vertical
      const filtered = filterQueriesByCategory(parsedQueries, primaryCategory, input.address);
      const finalQueries = filtered.length > 0 ? filtered : parsedQueries;
      const result = finalQueries.slice(0, 6);
      
      console.log('[discoveryQueries] ✅ Returning OpenAI-generated queries', {
        originalCount: parsedQueries.length,
        filteredCount: filtered.length,
        finalCount: result.length,
        queries: result,
        source: 'openai',
      });
      
      // Cache the result
      discoveryQueriesCache.set(cacheKey, {
        queries: result,
        timestamp: Date.now(),
      });
      
      return result;
    }

    // If we couldn't parse anything from OpenAI, throw an error
    console.error('[discoveryQueries] ❌ All parsing attempts failed - OpenAI response could not be parsed', {
      contentReceived: content,
    });
    throw new Error('Failed to parse OpenAI response - response format invalid');
  } catch (error) {
    // Re-throw if it's already an Error we created
    if (error instanceof Error && (
      error.message.includes('OPENAI_API_KEY') ||
      error.message.includes('OpenAI API error') ||
      error.message.includes('OpenAI returned empty') ||
      error.message.includes('Failed to parse OpenAI')
    )) {
      throw error;
    }
    
    // For unexpected errors, log and re-throw
    console.error('[discoveryQueries] Exception in generateDiscoveryQueriesForBusiness:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to generate discovery queries: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Filter queries to match the business's vertical/category.
 */
function filterQueriesByCategory(
  queries: string[], 
  primaryCategory: string | null | undefined,
  address?: string | null
): string[] {
  if (!primaryCategory) {
    return queries; // No category to filter by
  }

  const anchor = getAnchorCategoryTokens(primaryCategory);
  
  if (!anchor.anchorLabel || anchor.keywordTokens.length === 0) {
    return queries; // No anchor tokens to filter by
  }

  const normalizedQueries = queries.map(q => q.toLowerCase());
  const filtered: string[] = [];

  for (const query of queries) {
    const normalized = query.toLowerCase();
    
    // Check if query includes any keyword tokens
    const hasKeywordToken = anchor.keywordTokens.some(token => 
      normalized.includes(token.toLowerCase())
    );
    
    // For restaurants/food, also allow food-related terms
    const isFoodRelated = anchor.allowedTypes.some(type => 
      type.includes('restaurant') || type.includes('cafe') || type.includes('food')
    ) && (
      normalized.includes('food') || 
      normalized.includes('restaurant') || 
      normalized.includes('dining') ||
      normalized.includes('cafe') ||
      normalized.includes('coffee')
    );
    
    if (hasKeywordToken || isFoodRelated) {
      filtered.push(query);
    }
  }

  // If filtering removed everything, synthesize category-safe queries
  if (filtered.length === 0) {
    const location = extractLocationFromAddress(address);
    const area = location || '';
    
    // Synthesize queries based on anchor tokens
    if (anchor.keywordTokens.length > 0) {
      const mainToken = anchor.keywordTokens[0];
      if (area) {
        filtered.push(`${mainToken} ${area}`);
        filtered.push(`best ${mainToken} ${area}`);
      }
      filtered.push(`best ${mainToken} near me`);
      if (anchor.keywordTokens.length > 1) {
        filtered.push(`${anchor.keywordTokens.slice(0, 2).join(' ')} ${area || 'near me'}`);
      }
    }
  }

  return filtered.length > 0 ? filtered : queries; // Fallback to original if synthesis failed
}

/**
 * Extract location (neighborhood/city) from full address.
 */
function extractLocationFromAddress(address: string | null | undefined): string {
  if (!address) return '';
  
  const parts = address.split(',').map(p => p.trim());
  // Try to extract neighborhood (usually 2nd part) or city (usually 3rd part)
  if (parts.length >= 3) {
    return parts[1] || parts[2] || '';
  } else if (parts.length >= 2) {
    return parts[1] || '';
  }
  return parts[0] || '';
}

/**
 * Generate fallback queries when AI is unavailable or fails.
 * Never uses hardcoded "restaurant" - always uses the actual category.
 */
function generateFallbackQueries(input: GenerateDiscoveryQueriesInput): string[] {
  const queries: string[] = [];
  const primaryCategory = input.primary_category || input.category || null;
  
  // Never default to "restaurant" - use the actual category or synthesize from anchor
  let category = primaryCategory;
  if (!category) {
    // If no category, we can't generate meaningful queries
    return [];
  }
  
  const location = extractLocationFromAddress(input.address);

  // Build base queries from available data
  if (category && location) {
    queries.push(`${category} ${location}`);
    queries.push(`best ${category} ${location}`);
    queries.push(`${category} ${location} near me`);
  }

  if (category) {
    if (!queries.some(q => q.includes('near me'))) {
      queries.push(`${category} near me`);
    }
    if (!queries.some(q => q.includes('best') && !q.includes(location))) {
      queries.push(`best ${category}`);
    }
  }

  // Add more variations to reach 4-6 queries
  if (category && location && queries.length < 6) {
    if (!queries.some(q => q.includes('open now'))) {
      queries.push(`${category} ${location} open now`);
    }
    if (!queries.some(q => q.includes('top'))) {
      queries.push(`top ${category} ${location}`);
    }
  }

  if (category && queries.length < 6) {
    if (!queries.some(q => q.includes('top') && !q.includes(location))) {
      queries.push(`top ${category}`);
    }
    if (!queries.some(q => q.includes('good'))) {
      queries.push(`good ${category}`);
    }
  }

  // Add name-based query if available
  if (input.name && !queries.some(q => q.includes(input.name || ''))) {
    queries.push(`${input.name} reviews`);
  }

  // Ensure we have at least 4 queries
  if (queries.length < 4) {
    const defaults = [
      `${category} near me`,
      `best ${category}`,
      `top ${category}`,
      `${category} open now`,
    ];
    defaults.forEach(defaultQuery => {
      if (!queries.includes(defaultQuery) && queries.length < 6) {
        queries.push(defaultQuery);
      }
    });
  }

  // Final fallback: synthesize from category if still empty
  if (queries.length === 0 && category) {
    const anchor = getAnchorCategoryTokens(category);
    if (anchor.keywordTokens.length > 0) {
      const mainToken = anchor.keywordTokens[0];
      if (location) {
        queries.push(`${mainToken} ${location}`);
        queries.push(`best ${mainToken} ${location}`);
      }
      queries.push(`${mainToken} near me`);
      queries.push(`best ${mainToken}`);
    } else {
      // Last resort: use category as-is
      if (location) {
        queries.push(`${category} ${location}`);
      }
      queries.push(`${category} near me`);
    }
  }

  return queries.slice(0, 6);
}

/**
 * Get discovery queries for a business (public API).
 * This is a wrapper that matches the expected signature.
 */
export async function getDiscoveryQueriesForBusiness(input: {
  name: string | null;
  category: string | null;
  address?: string | null;
  primary_category?: string | null;
}): Promise<string[]> {
  return generateDiscoveryQueriesForBusiness({
    name: input.name,
    category: input.category,
    address: input.address,
    primary_category: input.primary_category,
  });
}

/**
 * Get the primary discovery query for a business.
 * Returns the first filtered query, or synthesizes one if needed.
 * NOTE: This is used for the "How people should be finding you" chips.
 */
export async function getPrimaryDiscoveryQuery(business: BusinessRow): Promise<string> {
  const queries = await getDiscoveryQueriesForBusiness({
    name: business.name,
    category: business.category || null,
    primary_category: business.primary_category || null,
    address: business.address || null,
  });

  if (queries.length > 0) {
    return queries[0];
  }

  // Fallback: synthesize from category
  const primaryCategory = business.primary_category || business.category || null;
  if (!primaryCategory) {
    // Last resort: use business name + location
    const location = extractLocationFromAddress(business.address);
    if (location && business.name) {
      return `${business.name} ${location}`;
    }
    return business.name || 'business near me';
  }

  const anchor = getAnchorCategoryTokens(primaryCategory);
  const location = extractLocationFromAddress(business.address);
  
  if (anchor.keywordTokens.length > 0) {
    const mainToken = anchor.keywordTokens[0];
    if (location) {
      return `${mainToken} ${location}`;
    }
    return `${mainToken} near me`;
  }

  // Use category as-is
  if (location) {
    return `${primaryCategory} ${location}`;
  }
  return `${primaryCategory} near me`;
}

/**
 * Extract suburb and city from a formatted address.
 * Filters out street names, building names, postal codes, and country.
 */
function extractSuburbAndCity(addr: string): string {
  // 1) Split on commas
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean);

  // 2) Drop obvious non-location parts:
  //    - any part containing digits
  //    - country names (e.g. 'South Africa')
  //    - very short tokens like 'Rd', 'St', etc.
  const locationParts = parts.filter(p => {
    const lower = p.toLowerCase();
    if (/\d/.test(lower)) return false;
    if (lower.includes('south africa')) return false;
    if (lower === 'za') return false;
    // Filter out common street/road indicators
    if (lower.match(/^(rd|st|street|road|ave|avenue|drive|dr|way|close|cl|place|pl)$/)) return false;
    return true;
  });

  // 3) Take the LAST TWO remaining segments as [suburb, city]
  //    (if only one, use that as city; if 3+, take last two).
  if (locationParts.length >= 2) {
    const city = locationParts[locationParts.length - 1];
    const suburb = locationParts[locationParts.length - 2];
    return `${suburb} ${city}`.trim();
  }
  if (locationParts.length === 1) {
    return locationParts[0];
  }
  return '';
}

/**
 * Get the primary ranking query for a business.
 * This is used specifically for the "Who's beating you for your top search?" section.
 * Returns a single, high-intent local Google search phrase focused on category + area.
 */
export async function getPrimaryRankingQueryForBusiness(business: {
  name: string;
  primary_category?: string | null;
  category?: string | null;
  formatted_address?: string | null;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Build context
  const category = business.primary_category || business.category || 'business';
  const area = business.formatted_address
    ? extractSuburbAndCity(business.formatted_address)
    : '';

  // Require OpenAI API key
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY not configured');
    console.error('[getPrimaryRankingQueryForBusiness] OPENAI_API_KEY not configured');
    throw error;
  }

  try {
    const systemPrompt = `You generate a single high-intent local Google search phrase for ranking businesses.`;

    const userPrompt = `Business:
- Name: ${business.name}
- Category: ${category}
- Area: ${area || 'unknown'}

Requirements:
- Return exactly ONE search query.
- Do NOT include the brand/business name.
- Focus on the category and the area.
- If area is provided, use ONLY suburb + city (e.g. 'Parktown Johannesburg'),
  do NOT use street names, building names, estates, complex names, or country.
- If Johannesburg is the city, use both suburb and city (e.g. 'Parktown Johannesburg'). But if the city is not Johannesburg, use only the city (e.g. 'Sandton').
- Format: '<category keywords> <suburb> <city>'
  Examples:
  'thai restaurant Sandton Johannesburg'
  'accounting firm Parktown Johannesburg'
  'grocery store Florida Glen Roodepoort'
- If area is missing, use '<category keywords> near me' with no brand name.
- No quotes, no hashtags, no extra commentary.

For a boutique hotel at an address like "61 Bowling Ave, Morningside Manor, Sandton, 2196, South Africa", a good search query would be:
- 'boutique hotel sandton'

It's fine if we go a little broad here, as long as it's relevant to the category and area.`;

    console.log('[getPrimaryRankingQueryForBusiness] Calling OpenAI API', {
      hasApiKey: !!apiKey,
      model: 'gpt-4o-mini',
      category,
      area,
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent, focused output
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getPrimaryRankingQueryForBusiness] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    console.log('[getPrimaryRankingQueryForBusiness] OpenAI response received', {
      hasContent: !!content,
      contentPreview: content?.substring(0, 100) || 'none',
    });

    if (!content) {
      console.error('[getPrimaryRankingQueryForBusiness] No content in OpenAI response');
      throw new Error('OpenAI returned empty response');
    }

    // Clean up the response: remove quotes, trim, normalize whitespace
    let cleaned = content
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/#/g, '') // Remove hashtags
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace

    // Validate: should not be empty or too short
    if (cleaned.length < 3) {
      console.error('[getPrimaryRankingQueryForBusiness] Response too short', { cleaned });
      throw new Error('OpenAI response too short or invalid');
    }

    // Safety check: ensure it doesn't include the business name
    const businessNameLower = business.name.toLowerCase();
    if (cleaned.toLowerCase().includes(businessNameLower)) {
      console.error('[getPrimaryRankingQueryForBusiness] Response includes business name', { cleaned });
      throw new Error('OpenAI response includes business name (invalid)');
    }

    console.log('[getPrimaryRankingQueryForBusiness] ✅ Successfully generated query from OpenAI', { query: cleaned });
    return cleaned;
  } catch (error) {
    // Re-throw if it's already an Error we created
    if (error instanceof Error && (
      error.message.includes('OPENAI_API_KEY') ||
      error.message.includes('OpenAI API error') ||
      error.message.includes('OpenAI returned empty') ||
      error.message.includes('OpenAI response')
    )) {
      throw error;
    }
    
    // For unexpected errors, log and re-throw
    console.error('[getPrimaryRankingQueryForBusiness] Exception:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to generate primary ranking query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a broader ranking query for a business when the primary query returns no meaningful leaders.
 * This is used as a fallback to broaden the category while keeping the same area rules.
 */
export async function getBroaderRankingQueryForBusiness(business: {
  name: string;
  primary_category?: string | null;
  category?: string | null;
  formatted_address?: string | null;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Build context
  const category = business.primary_category || business.category || 'business';
  const area = business.formatted_address
    ? extractSuburbAndCity(business.formatted_address)
    : '';

  // Require OpenAI API key
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY not configured');
    console.error('[getBroaderRankingQueryForBusiness] OPENAI_API_KEY not configured');
    throw error;
  }

  try {
    const systemPrompt = `You generate a single SLIGHTLY BROADER local Google search phrase when the original phrase is too specific or returns no useful competitors. Focus on intent and locality. Broaden the category, not the geography.`;

    const userPrompt = `Business:
- Name: ${business.name}
- Category: ${category}
- Area: ${area || 'unknown'}

The original strict query returned no meaningful competitors. Generate a SLIGHTLY BROADER search query.

Requirements:
- Return exactly ONE broader search query.
- Do NOT include the brand/business name.
- Broaden the CATEGORY, not the geography.
  Examples:
  - If original was "greek restaurant Parkhurst Randburg", broaden to "restaurant Parkhurst Randburg"
  - If original was "iPhone repair Newlands Randburg", broaden to "cell phone repair Randburg" or "electronics store Randburg"
  - If original was "vegan bakery Sandton", broaden to "bakery Sandton" or "cafe Sandton"
- Keep the SAME AREA rules:
  - If area is provided, use ONLY suburb + city (e.g. 'Parktown Johannesburg')
  - Do NOT use street names, building names, estates, complex names, or country
  - If Johannesburg is the city, use both suburb and city (e.g. 'Parktown Johannesburg')
  - If city is not Johannesburg, use only the city (e.g. 'Sandton')
- Format: '<broader category> <suburb> <city>' or '<broader category> <city>'
- If area is missing, use '<broader category> near me'
- No quotes, no hashtags, no extra commentary.

Make it broader but still relevant to the business type.`;

    console.log('[getBroaderRankingQueryForBusiness] Calling OpenAI API', {
      hasApiKey: !!apiKey,
      model: 'gpt-4o-mini',
      category,
      area,
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4, // Slightly higher temperature for more creative broadening
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getBroaderRankingQueryForBusiness] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    console.log('[getBroaderRankingQueryForBusiness] OpenAI response received', {
      hasContent: !!content,
      contentPreview: content?.substring(0, 100) || 'none',
    });

    if (!content) {
      console.error('[getBroaderRankingQueryForBusiness] No content in OpenAI response');
      throw new Error('OpenAI returned empty response');
    }

    // Clean up the response: remove quotes, trim, normalize whitespace
    let cleaned = content
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/#/g, '') // Remove hashtags
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace

    // Validate: should not be empty or too short
    if (cleaned.length < 3) {
      console.error('[getBroaderRankingQueryForBusiness] Response too short', { cleaned });
      throw new Error('OpenAI response too short or invalid');
    }

    // Safety check: ensure it doesn't include the business name
    const businessNameLower = business.name.toLowerCase();
    if (cleaned.toLowerCase().includes(businessNameLower)) {
      console.error('[getBroaderRankingQueryForBusiness] Response includes business name', { cleaned });
      throw new Error('OpenAI response includes business name (invalid)');
    }

    console.log('[getBroaderRankingQueryForBusiness] ✅ Successfully generated broader query from OpenAI', { query: cleaned });
    return cleaned;
  } catch (error) {
    // Re-throw if it's already an Error we created
    if (error instanceof Error && (
      error.message.includes('OPENAI_API_KEY') ||
      error.message.includes('OpenAI API error') ||
      error.message.includes('OpenAI returned empty') ||
      error.message.includes('OpenAI response')
    )) {
      throw error;
    }
    
    // For unexpected errors, log and re-throw
    console.error('[getBroaderRankingQueryForBusiness] Exception:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to generate broader ranking query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fallback for ranking query generation.
 * Never uses hardcoded "restaurant" - always uses the actual category.
 */
function getRankingQueryFallback(category: string, area: string): string {
  // Normalize category: lowercase and clean
  const normalizedCategory = category.toLowerCase().trim();
  
  // If area is non-empty, use category + area
  if (area) {
    return `${normalizedCategory} ${area}`.trim();
  }
  
  // Otherwise use category + "near me"
  return `${normalizedCategory} near me`;
}


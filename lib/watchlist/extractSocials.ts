/**
 * Extract social media URLs/handles from Google Places API data or competitor raw data.
 */

export interface ExtractedSocial {
  network: 'instagram' | 'tiktok' | 'facebook';
  handle_or_url: string; // Full URL for storage
  source: 'gbp' | 'manual';
}

export interface PrefilledSocial {
  instagram?: string; // Just username
  tiktok?: string; // Just username
  facebook?: string; // Just username or page slug
}

/**
 * Extract social media profiles from Google Places API raw data.
 * Looks for website, facebook, instagram, and tiktok URLs.
 */
export function extractSocialsFromRawData(raw: any): ExtractedSocial[] {
  const socials: ExtractedSocial[] = [];

  if (!raw || typeof raw !== 'object') {
    return socials;
  }

  // Extract website URL
  const website = raw.website || raw.url || null;
  
  // Extract from website if it contains social media domains
  if (website && typeof website === 'string') {
    const websiteLower = website.toLowerCase();
    
    // Check for Instagram
    const instagramMatch = websiteLower.match(/(?:instagram\.com\/|instagr\.am\/)([a-zA-Z0-9._]+)/);
    if (instagramMatch) {
      const handle = instagramMatch[1].replace(/\/$/, ''); // Remove trailing slash
      socials.push({
        network: 'instagram',
        handle_or_url: `https://www.instagram.com/${handle}`,
        source: 'gbp',
      });
    }
    
    // Check for TikTok
    const tiktokMatch = websiteLower.match(/(?:tiktok\.com\/@)([a-zA-Z0-9._]+)/);
    if (tiktokMatch) {
      const handle = tiktokMatch[1].replace(/\/$/, '');
      socials.push({
        network: 'tiktok',
        handle_or_url: `https://www.tiktok.com/@${handle}`,
        source: 'gbp',
      });
    }
    
    // Check for Facebook
    const facebookMatch = websiteLower.match(/(?:facebook\.com\/|fb\.com\/)([a-zA-Z0-9.]+)/);
    if (facebookMatch) {
      const handle = facebookMatch[1].replace(/\/$/, '');
      socials.push({
        network: 'facebook',
        handle_or_url: `https://www.facebook.com/${handle}`,
        source: 'gbp',
      });
    }
  }

  // Check for direct social media fields in raw data
  // Google Places API sometimes includes these
  if (raw.facebook && typeof raw.facebook === 'string') {
    const fbUrl = raw.facebook.trim();
    if (fbUrl && !socials.some(s => s.network === 'facebook')) {
      socials.push({
        network: 'facebook',
        handle_or_url: fbUrl,
        source: 'gbp',
      });
    }
  }

  if (raw.instagram && typeof raw.instagram === 'string') {
    const igUrl = raw.instagram.trim();
    if (igUrl && !socials.some(s => s.network === 'instagram')) {
      socials.push({
        network: 'instagram',
        handle_or_url: igUrl,
        source: 'gbp',
      });
    }
  }

  if (raw.tiktok && typeof raw.tiktok === 'string') {
    const tiktokUrl = raw.tiktok.trim();
    if (tiktokUrl && !socials.some(s => s.network === 'tiktok')) {
      socials.push({
        network: 'tiktok',
        handle_or_url: tiktokUrl,
        source: 'gbp',
      });
    }
  }

  // Also check in international_phone_number or other fields that might contain URLs
  // Some businesses list socials in their description or other fields
  const description = raw.editorial_summary?.overview || raw.description || '';
  if (description && typeof description === 'string') {
    const descLower = description.toLowerCase();
    
    // Extract Instagram
    const igMatches = descLower.match(/(?:instagram|ig|@)(?:\.com\/)?([a-zA-Z0-9._]+)/g);
    if (igMatches && !socials.some(s => s.network === 'instagram')) {
      const match = igMatches[0].match(/([a-zA-Z0-9._]+)$/);
      if (match) {
        socials.push({
          network: 'instagram',
          handle_or_url: `https://www.instagram.com/${match[1]}`,
          source: 'gbp',
        });
      }
    }
    
    // Extract TikTok
    const tiktokMatches = descLower.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/g);
    if (tiktokMatches && !socials.some(s => s.network === 'tiktok')) {
      const match = tiktokMatches[0].match(/@([a-zA-Z0-9._]+)/);
      if (match) {
        socials.push({
          network: 'tiktok',
          handle_or_url: `https://www.tiktok.com/@${match[1]}`,
          source: 'gbp',
        });
      }
    }
  }

  return socials;
}

/**
 * Extract social media usernames from GBP data for prefilling modal fields.
 * Returns just the usernames (not full URLs) for easy editing.
 */
export function extractWatchlistSocialsFromGBP(raw: any): PrefilledSocial {
  const prefilled: PrefilledSocial = {};

  if (!raw || typeof raw !== 'object') {
    return prefilled;
  }

  // Extract socials using existing function
  const extractedSocials = extractSocialsFromRawData(raw);

  // Convert to prefilled format (just usernames)
  for (const social of extractedSocials) {
    const username = normalizeSocialHandle(social.network, social.handle_or_url);
    if (username) {
      prefilled[social.network] = username;
    }
  }

  return prefilled;
}

/**
 * Extract username/handle from a social media URL or handle string.
 * Returns just the username (e.g., "themaxhotelsandton" from "https://www.instagram.com/themaxhotelsandton/")
 */
export function normalizeSocialHandle(network: 'instagram' | 'tiktok' | 'facebook', raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Remove @ prefix if present
  let cleaned = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  // If it's a URL, extract the username
  if (cleaned.includes('://') || cleaned.includes('.')) {
    const urlLower = cleaned.toLowerCase();
    
    switch (network) {
      case 'instagram':
        // Match: instagram.com/username or instagr.am/username
        const igMatch = urlLower.match(/(?:instagram\.com\/|instagr\.am\/)([a-zA-Z0-9._]+)/);
        if (igMatch) {
          cleaned = igMatch[1];
        }
        break;
      case 'tiktok':
        // Match: tiktok.com/@username or tiktok.com/username
        const tiktokMatch = urlLower.match(/tiktok\.com\/@?([a-zA-Z0-9._]+)/);
        if (tiktokMatch) {
          cleaned = tiktokMatch[1];
        }
        break;
      case 'facebook':
        // Match: facebook.com/username or fb.com/username
        const fbMatch = urlLower.match(/(?:facebook\.com\/|fb\.com\/)([a-zA-Z0-9.]+)/);
        if (fbMatch) {
          cleaned = fbMatch[1];
        }
        break;
    }
  }

  // Remove trailing slashes, query params, fragments
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];

  // Lowercase for Instagram and TikTok (Facebook can keep case)
  if (network === 'instagram' || network === 'tiktok') {
    cleaned = cleaned.toLowerCase();
  }

  return cleaned;
}

/**
 * Normalize a social media URL to a consistent format (full URL).
 */
export function normalizeSocialUrl(url: string, network: 'instagram' | 'tiktok' | 'facebook'): string {
  const trimmed = url.trim();
  
  // If it's already a full URL, return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Extract handle first
  const handle = normalizeSocialHandle(network, trimmed);
  
  // Build full URL based on network
  switch (network) {
    case 'instagram':
      return `https://www.instagram.com/${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`;
    case 'facebook':
      // Facebook can be either a page name or full URL
      if (handle.includes('facebook.com')) {
        return handle.startsWith('http') ? handle : `https://${handle}`;
      }
      return `https://www.facebook.com/${handle}`;
    default:
      return trimmed;
  }
}


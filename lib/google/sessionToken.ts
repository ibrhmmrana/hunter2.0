/**
 * Manages session tokens for Google Places API autocomplete requests.
 * Session tokens group autocomplete → details requests for billing.
 * 
 * Note: For Places API v1, we generate UUID strings that can be passed to the server.
 * The AutocompleteSessionToken from the JS library is used for client-side autocomplete.
 */

/**
 * Generates a UUID v4 string for use as a session token
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Use any type to avoid server-side type errors
let currentSessionToken: any = null;
let currentSessionTokenString: string | null = null;

/**
 * Checks if we're on the client side and Google Maps is available
 */
function isClientWithMaps(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.google !== 'undefined' &&
         window.google?.maps?.places?.AutocompleteSessionToken !== undefined;
}

/**
 * Creates a new session token pair. Call this when starting a new search session.
 * Returns both the JS library token and a string token for API calls.
 */
export function createSessionToken(): {
  jsToken: any;
  stringToken: string;
} {
  if (!isClientWithMaps()) {
    // On server or before Maps loads, just return a string token
    currentSessionTokenString = generateUUID();
    return {
      jsToken: null,
      stringToken: currentSessionTokenString,
    };
  }

  currentSessionToken = new window.google.maps.places.AutocompleteSessionToken();
  currentSessionTokenString = generateUUID();
  return {
    jsToken: currentSessionToken,
    stringToken: currentSessionTokenString,
  };
}

/**
 * Gets the current session tokens, creating them if none exist.
 */
export function getSessionToken(): {
  jsToken: any;
  stringToken: string;
} {
  if (!currentSessionToken || !currentSessionTokenString) {
    return createSessionToken();
  }
  return {
    jsToken: currentSessionToken,
    stringToken: currentSessionTokenString,
  };
}

/**
 * Resets the session token (call after a place is selected).
 */
export function resetSessionToken(): void {
  currentSessionToken = null;
  currentSessionTokenString = null;
}

/**
 * Gets the session token string for API calls.
 */
export function getSessionTokenString(): string | null {
  return currentSessionTokenString;
}


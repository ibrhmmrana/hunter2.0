/**
 * Utility to load Google Maps JavaScript API with Places library
 */

declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

interface MapsScriptOptions {
  apiKey: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

let isLoading = false;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Loads the Google Maps JavaScript API script with Places library
 */
export function loadMapsScript(options: MapsScriptOptions): Promise<void> {
  const { apiKey, onLoad, onError } = options;

  // Guard against SSR
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const error = new Error('loadMapsScript can only be called on the client');
    onError?.(error);
    return Promise.reject(error);
  }

  if (isLoaded && window.google?.maps?.places) {
    onLoad?.();
    return Promise.resolve();
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`)) {
      // Script already exists, wait for it
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkInterval);
          isLoading = false;
          isLoaded = true;
          onLoad?.();
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!isLoaded) {
          isLoading = false;
          const error = new Error('Google Maps API failed to load');
          onError?.(error);
          reject(error);
        }
      }, 10000);
      return;
    }

    window.initGoogleMaps = () => {
      isLoading = false;
      isLoaded = true;
      onLoad?.();
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      isLoading = false;
      const error = new Error('Failed to load Google Maps API');
      onError?.(error);
      reject(error);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}


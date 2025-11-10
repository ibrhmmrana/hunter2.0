// Google Maps types - only loaded on client side
declare global {
  interface Window {
    google?: any;
    initGoogleMaps?: () => void;
  }
}

export {};


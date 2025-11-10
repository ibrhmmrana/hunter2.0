"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { loadMapsScript } from "@/lib/google/mapsScript";
import { createSessionToken, resetSessionToken } from "@/lib/google/sessionToken";
import { cn } from "@/lib/utils";
import { useToast, ToastContainer } from "./Toast";

interface AutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface BusinessSearchBoxProps {
  onSelect?: (placeId: string) => void;
}

export function BusinessSearchBox({ onSelect }: BusinessSearchBoxProps) {
  const { toasts, addToast, dismissToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<{
    jsToken: any;
    stringToken: string;
  } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Maps API
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API key not configured");
      setIsLoadingMaps(false);
      return;
    }

    loadMapsScript({
      apiKey,
      onLoad: () => {
        setIsLoadingMaps(false);
        if (typeof window !== 'undefined' && window.google?.maps?.places) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        }
      },
      onError: (err) => {
        setError(`Failed to load Google Maps: ${err.message}`);
        setIsLoadingMaps(false);
      },
    });
  }, []);

  // Handle autocomplete with debounce
  const fetchPredictions = useCallback(
    (query: string) => {
      if (!autocompleteServiceRef.current || !query.trim()) {
        setPredictions([]);
        setSelectedIndex(-1);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Create a new session token for new queries
      if (!sessionTokenRef.current || inputValue !== query) {
        sessionTokenRef.current = createSessionToken();
      }

      // Only make request if we have a valid JS token (Maps API loaded)
      if (!sessionTokenRef.current.jsToken) {
        setIsLoading(false);
        setError("Google Maps is still loading. Please wait...");
        return;
      }

      const request = {
        input: query,
        sessionToken: sessionTokenRef.current.jsToken,
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (results: any, status: string) => {
          setIsLoading(false);

          if (status === 'OK' && results) {
            setPredictions(
              results.map((result) => ({
                place_id: result.place_id,
                description: result.description,
                structured_formatting: result.structured_formatting,
              }))
            );
            setSelectedIndex(-1);
          } else if (status === 'ZERO_RESULTS') {
            setPredictions([]);
          } else {
            const errorMsg = "Failed to fetch suggestions. Please try again.";
            setError(errorMsg);
            addToast(errorMsg, "error");
            setPredictions([]);
          }
        }
      );
    },
    [inputValue, addToast]
  );

  // Debounced input handler
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      setError(null);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        fetchPredictions(value);
      }, 200);
    },
    [fetchPredictions]
  );

  // Handle place selection
  const handleSelectPlace = useCallback(
    (placeId: string) => {
      setError(null);
      setPredictions([]);
      setInputValue("");
      resetSessionToken();
      sessionTokenRef.current = null;

      // Call onSelect callback - navigation is handled by parent
      onSelect?.(placeId);
    },
    [onSelect]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (predictions.length === 0) {
        if (e.key === "Enter" && inputValue.trim()) {
          e.preventDefault();
          // Could trigger search, but we require selection
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < predictions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && predictions[selectedIndex]) {
            handleSelectPlace(predictions[selectedIndex].place_id);
          }
          break;
        case "Escape":
          e.preventDefault();
          setPredictions([]);
          setSelectedIndex(-1);
          break;
      }
    },
    [predictions, selectedIndex, inputValue, handleSelectPlace]
  );

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setPredictions([]);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoadingMaps) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading search...
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Type your business name..."
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pr-10"
          autoComplete="off"
          aria-label="Business search"
          aria-expanded={predictions.length > 0}
          aria-haspopup="listbox"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-sm text-destructive">{error}</div>
      )}

      {predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-full rounded-2xl border bg-card shadow-lg max-h-80 overflow-auto"
          role="listbox"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              onClick={() => handleSelectPlace(prediction.place_id)}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent transition-colors",
                "flex items-start gap-3",
                index === selectedIndex && "bg-accent"
              )}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {prediction.structured_formatting?.main_text ||
                    prediction.description}
                </div>
                {prediction.structured_formatting?.secondary_text && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {prediction.structured_formatting.secondary_text}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}


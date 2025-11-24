"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  TextField,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Paper,
  Typography,
  InputAdornment,
  Portal,
} from "@mui/material";
import LocationOnRounded from "@mui/icons-material/LocationOnRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { loadMapsScript } from "@/lib/google/mapsScript";
import { createSessionToken, resetSessionToken } from "@/lib/google/sessionToken";
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
  const [showDropdown, setShowDropdown] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const inputElementRef = useRef<HTMLInputElement | null>(null);
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
        setShowDropdown(false);
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
            setShowDropdown(true);
          } else if (status === 'ZERO_RESULTS') {
            setPredictions([]);
            setShowDropdown(false);
          } else {
            const errorMsg = "Failed to fetch suggestions. Please try again.";
            setError(errorMsg);
            addToast(errorMsg, "error");
            setPredictions([]);
            setShowDropdown(false);
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
      setShowDropdown(false);
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
          setShowDropdown(false);
          break;
      }
    },
    [predictions, selectedIndex, inputValue, handleSelectPlace]
  );

  // Store reference to actual input element for precise positioning
  useEffect(() => {
    const findInputElement = () => {
      if (inputRef.current) {
        // inputRef.current is the TextField's root element
        const container = inputRef.current as HTMLElement;
        // Find the actual input element within the TextField
        const inputElement = container.querySelector('input[type="text"]') as HTMLInputElement | null;
        if (inputElement) {
          inputElementRef.current = inputElement;
        }
      }
    };
    
    findInputElement();
    // Also try after a small delay to ensure DOM is ready
    const timeoutId = setTimeout(findInputElement, 10);
    
    return () => clearTimeout(timeoutId);
  }, [showDropdown, inputValue]);

  // Update dropdown position when input position changes (for Portal)
  useEffect(() => {
    if (!showDropdown || !dropdownRef.current) return;

    const updatePosition = () => {
      if (!dropdownRef.current) return;
      
      // Always try to find the actual input element first
      let inputElement: HTMLInputElement | null = null;
      
      if (inputElementRef.current) {
        inputElement = inputElementRef.current;
      } else if (inputRef.current) {
        // Try to find input element within the TextField container
        const container = inputRef.current as HTMLElement;
        inputElement = container.querySelector('input[type="text"]') as HTMLInputElement | null;
        if (inputElement) {
          inputElementRef.current = inputElement;
        }
      }
      
      if (inputElement) {
        const rect = inputElement.getBoundingClientRect();
        dropdownRef.current.style.left = `${rect.left}px`;
        dropdownRef.current.style.top = `${rect.bottom + 4}px`;
        dropdownRef.current.style.width = `${rect.width}px`;
      } else if (inputRef.current) {
        // Last resort: use container (but this should rarely happen)
        const container = inputRef.current as HTMLElement;
        const rect = container.getBoundingClientRect();
        dropdownRef.current.style.left = `${rect.left}px`;
        dropdownRef.current.style.top = `${rect.bottom + 4}px`;
        dropdownRef.current.style.width = `${rect.width}px`;
      }
    };

    // Use requestAnimationFrame for smoother updates
    const rafId = requestAnimationFrame(() => {
      updatePosition();
      // Also set up interval updates for scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDropdown, predictions]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoadingMaps) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Loading search...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <TextField
        inputRef={inputRef}
        fullWidth
          placeholder="Type your business name..."
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        onFocus={() => {
          if (predictions.length > 0) {
            setShowDropdown(true);
          }
        }}
        variant="outlined"
        sx={{
          backgroundColor: "surface.variant",
          borderRadius: 999,
          "& fieldset": { borderColor: "transparent" },
          "&:hover fieldset": { borderColor: "transparent" },
          "& .MuiOutlinedInput-root": {
            borderRadius: 999,
            "&:focus-within fieldset": {
              borderColor: "primary.main",
            },
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: isLoading && (
            <InputAdornment position="end">
              <CircularProgress size={16} />
            </InputAdornment>
          ),
        }}
          autoComplete="off"
          aria-label="Business search"
        aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />

      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
          {error}
        </Typography>
      )}

      {showDropdown && predictions.length > 0 && (
        <Portal container={typeof document !== 'undefined' ? document.body : null}>
          <Paper
            ref={dropdownRef}
            elevation={8}
            sx={{
              position: "fixed",
              zIndex: 1400, // Higher than MUI Dialog (1300)
              maxHeight: 320,
              overflow: "auto",
              borderRadius: 3,
              // Position and width will be set dynamically via useEffect
            }}
            role="listbox"
          >
            <List sx={{ py: 0.5 }}>
            {predictions.map((prediction, index) => (
                <ListItemButton
                key={prediction.place_id}
                onClick={() => handleSelectPlace(prediction.place_id)}
                  selected={index === selectedIndex}
                  sx={{
                    borderRadius: 1,
                    mx: 0.5,
                    "&.Mui-selected": {
                      backgroundColor: "action.selected",
                    },
                  }}
                role="option"
                aria-selected={index === selectedIndex}
              >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <LocationOnRounded fontSize="small" color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={500}>
                    {prediction.structured_formatting?.main_text ||
                      prediction.description}
                      </Typography>
                    }
                    secondary={
                      prediction.structured_formatting?.secondary_text && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                      {prediction.structured_formatting.secondary_text}
                        </Typography>
                      )
                    }
                  />
                </ListItemButton>
            ))}
            </List>
          </Paper>
        </Portal>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </Box>
  );
}

import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { cn } from "@/lib/utils";
import { TextInput, type TextInputProps } from "@/components/forms";

export interface PlaceResult {
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function parseComponents(components: any[]): { address: string; city: string; state: string; zip: string } {
  const get  = (t: string) => components.find((c: any) => c.types.includes(t))?.long_name  ?? "";
  const getS = (t: string) => components.find((c: any) => c.types.includes(t))?.short_name ?? "";
  return {
    address: [get("street_number"), get("route")].filter(Boolean).join(" "),
    city:    get("locality") || get("sublocality_level_1") || get("administrative_area_level_2") || get("administrative_area_level_3"),
    state:   getS("administrative_area_level_1"),
    zip:     get("postal_code"),
  };
}

async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  try {
    await loadGoogleMaps();
    const { Geocoder } = await (window as any).google.maps.importLibrary("geocoding");
    return await new Promise<PlaceResult | null>((resolve) => {
      new Geocoder().geocode({ placeId }, (results: any[], status: string) => {
        if (status !== "OK" || !results?.[0]) { resolve(null); return; }
        const r = results[0];
        const parsed = parseComponents(r.address_components ?? []);
        resolve({
          address: parsed.address || r.formatted_address || "",
          city:    parsed.city,
          state:   parsed.state,
          zip:     parsed.zip,
          lat:     r.geometry?.location?.lat() ?? null,
          lng:     r.geometry?.location?.lng() ?? null,
        });
      });
    });
  } catch {
    return null;
  }
}

// ── Core hook: manages predictions & selection ─────────────────────────────────

function useAddressAutocomplete(onPlaceSelect: ((r: PlaceResult) => void) | undefined) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const serviceRef  = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => (window as any).google.maps.importLibrary("places"))
      .then((lib: any) => {
        const Svc = lib?.AutocompleteService || (window as any).google?.maps?.places?.AutocompleteService;
        if (Svc) serviceRef.current = new Svc();
      })
      .catch(console.error);
  }, []);

  const fetchPredictions = useCallback((input: string) => {
    if (!serviceRef.current || input.length < 2) { setPredictions([]); setOpen(false); return; }
    serviceRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: "us" } },
      (results: any[], status: string) => {
        if (status === "OK" && results?.length) { setPredictions(results); setOpen(true); }
        else { setPredictions([]); setOpen(false); }
      }
    );
  }, []);

  const onInput = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(value), 250);
  }, [fetchPredictions]);

  const onSelect = useCallback(async (prediction: any, setInputValue: (v: string) => void) => {
    setOpen(false);
    setPredictions([]);
    // Show main text immediately while we fetch details
    setInputValue(prediction.structured_formatting?.main_text ?? prediction.description);
    const result = await getPlaceDetails(prediction.place_id);
    if (result) {
      setInputValue(result.address || prediction.structured_formatting?.main_text || prediction.description);
      onPlaceSelect?.(result);
    }
  }, [onPlaceSelect]);

  const close = useCallback(() => { setOpen(false); setPredictions([]); }, []);

  return { predictions, open, onInput, onSelect, close };
}

// ── Dropdown ───────────────────────────────────────────────────────────────────

function Dropdown({ predictions, onSelect }: { predictions: any[]; onSelect: (p: any) => void }) {
  return (
    <ul className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
      {predictions.map((p) => (
        <li
          key={p.place_id}
          // onMouseDown instead of onClick so it fires before onBlur hides the dropdown
          onMouseDown={(e) => { e.preventDefault(); onSelect(p); }}
          className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground truncate"
        >
          <span className="font-medium">{p.structured_formatting?.main_text}</span>
          {p.structured_formatting?.secondary_text && (
            <span className="text-muted-foreground ml-1 text-xs">{p.structured_formatting.secondary_text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Plain input variant ────────────────────────────────────────────────────────

interface PlainProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onPlaceSelect?: (r: PlaceResult) => void;
}

export const AddressAutocompleteInput = forwardRef<HTMLInputElement, PlainProps>(
  ({ onPlaceSelect, onChange, onBlur, className, value, defaultValue, ...props }, ref) => {
    const [inputValue, setInputValue] = useState<string>(
      (value as string) ?? (defaultValue as string) ?? ""
    );
    const { predictions, open, onInput, onSelect, close } = useAddressAutocomplete(onPlaceSelect);

    // Sync controlled value from outside
    useEffect(() => {
      if (value !== undefined) setInputValue(value as string);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      onInput(e.target.value);
      onChange?.(e);
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          value={inputValue}
          onChange={handleChange}
          onBlur={(e) => { setTimeout(close, 150); onBlur?.(e); }}
          autoComplete="off"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        {open && predictions.length > 0 && (
          <Dropdown predictions={predictions} onSelect={(p) => onSelect(p, setInputValue)} />
        )}
      </div>
    );
  },
);
AddressAutocompleteInput.displayName = "AddressAutocompleteInput";

// ── Floating-label variant ─────────────────────────────────────────────────────

type TextVariantProps = Omit<TextInputProps, "onChange"> & {
  onPlaceSelect?: (r: PlaceResult) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const AddressAutocompleteTextInput = forwardRef<HTMLInputElement, TextVariantProps>(
  ({ onPlaceSelect, onChange, onBlur, value, defaultValue, ...textProps }, ref) => {
    const [inputValue, setInputValue] = useState<string>(
      (value as string) ?? (defaultValue as string) ?? ""
    );
    const { predictions, open, onInput, onSelect, close } = useAddressAutocomplete(onPlaceSelect);

    // Sync controlled value from outside
    useEffect(() => {
      if (value !== undefined) setInputValue(value as string);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      onInput(e.target.value);
      onChange?.(e);
    };

    return (
      <div className="relative">
        <TextInput
          ref={ref}
          value={inputValue}
          onChange={handleChange}
          onBlur={(e) => { setTimeout(close, 150); onBlur?.(e); }}
          autoComplete="off"
          {...textProps}
        />
        {open && predictions.length > 0 && (
          <Dropdown predictions={predictions} onSelect={(p) => onSelect(p, setInputValue)} />
        )}
      </div>
    );
  },
);
AddressAutocompleteTextInput.displayName = "AddressAutocompleteTextInput";

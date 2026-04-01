const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

let loadPromise: Promise<void> | null = null;

/** Load the Maps JS bootstrap (v=weekly, loading=async — no legacy libraries). */
export function loadGoogleMaps(): Promise<void> {
  if (!MAPS_KEY) return Promise.reject(new Error("No Google Maps key configured"));
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const cb = `__gm_cb_${Date.now()}`;
    (window as any)[cb] = () => { delete (window as any)[cb]; resolve(); };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&v=weekly&callback=${cb}&loading=async`;
    script.async = true;
    script.onerror = () => { loadPromise = null; delete (window as any)[cb]; reject(new Error("Failed to load Google Maps")); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** Load the Maps + Marker libraries (populates google.maps.Map, Marker, Polyline, InfoWindow, etc.). */
export async function loadMapsLib(): Promise<any> {
  await loadGoogleMaps();
  const g = (window as any).google.maps;
  await Promise.all([
    g.importLibrary("maps"),
    g.importLibrary("marker"),
  ]);
  return g;
}

/** Load the Marker library. */
export async function loadMarkerLib(): Promise<any> {
  await loadGoogleMaps();
  return (window as any).google.maps.importLibrary("marker");
}

/** Load the Places library (PlaceAutocompleteElement, etc.). */
export async function loadPlacesLib(): Promise<any> {
  await loadGoogleMaps();
  return (window as any).google.maps.importLibrary("places");
}

export { MAPS_KEY };

import { loadGoogleMaps } from "./google-maps";

export interface GpsLocation {
  lat: number;
  lng: number;
  address: string;
}

/**
 * Get current GPS position and reverse-geocode it to an address.
 * Returns null if geolocation is unavailable or denied.
 */
export async function getCurrentLocation(): Promise<GpsLocation | null> {
  if (!navigator.geolocation) return null;

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
    );

    const { latitude: lat, longitude: lng } = pos.coords;
    const address = await reverseGeocode(lat, lng);
    return { lat, lng, address };
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    await loadGoogleMaps();
    const { Geocoder } = await (window as any).google.maps.importLibrary("geocoding");
    const geocoder = new Geocoder();
    return await new Promise<string>((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
        if (status === "OK" && results?.[0]?.formatted_address) {
          resolve(results[0].formatted_address);
        } else {
          resolve(fallback);
        }
      });
    });
  } catch {
    return fallback;
  }
}

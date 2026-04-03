import { useEffect, useRef } from "react";
import { loadMapsLib } from "@/lib/google-maps";

export interface MapEntry {
  id: number;
  entryType: string;
  timestamp: string;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  jobTitle?: string | null;
}

export interface TechTrack {
  technicianId: number;
  technicianName: string;
  technicianColor: string;
  entries: MapEntry[];
}

interface TechnicianMapProps {
  tracks: TechTrack[];
  className?: string;
  height?: number;
}

const ENTRY_COLORS: Record<string, string> = {
  day_start:    "#22c55e",
  day_end:      "#64748b",
  travel_start: "#3b82f6",
  travel_end:   "#06b6d4",
  work_start:   "#2563eb",
  work_end:     "#10b981",
  break_start:  "#eab308",
  break_end:    "#eab308",
};

const ENTRY_LABELS: Record<string, string> = {
  day_start:    "Day Start",
  day_end:      "Day End",
  travel_start: "Travel Start",
  travel_end:   "Arrived",
  work_start:   "Work Start",
  work_end:     "Work End",
  break_start:  "Break",
  break_end:    "Break End",
};

function fmtTime(ts: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(ts));
}

type GMap    = google.maps.Map;
type GLatLng = google.maps.LatLng;

function drawTracks(map: GMap, tracks: TechTrack[], infoWindow: google.maps.InfoWindow) {
  // Clear existing overlays (keep only the map itself)
  (map as any).__overlays?.forEach((o: any) => o.setMap(null));
  (map as any).__overlays = [];
  const add = (o: any) => { (map as any).__overlays.push(o); };

  const allPoints: GLatLng[] = [];
  const g = (window as any).google.maps;

  for (const track of tracks) {
    const pts = track.entries
      .filter(e => e.lat != null && e.lng != null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (pts.length === 0) continue;

    const coords = pts.map(e => new g.LatLng(e.lat!, e.lng!));
    allPoints.push(...coords);

    // Polyline track
    const polyline = new g.Polyline({
      path: coords,
      strokeColor: track.technicianColor,
      strokeWeight: 3,
      strokeOpacity: 0.9,
      icons: [{
        icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
        offset: "0",
        repeat: "16px",
      }],
      map,
    });
    add(polyline);

    for (const e of pts) {
      const color = ENTRY_COLORS[e.entryType] ?? track.technicianColor;
      const big   = e.entryType === "day_start" || e.entryType === "work_start" || e.entryType === "day_end";
      const lbl   = ENTRY_LABELS[e.entryType] ?? e.entryType.replace(/_/g, " ");

      const marker = new g.Marker({
        position: { lat: e.lat!, lng: e.lng! },
        map,
        icon: {
          path: g.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
          scale: big ? 11 : 8,
        },
        title: `${track.technicianName} — ${lbl}`,
        zIndex: big ? 10 : 5,
      });
      add(marker);

      const content = `
        <div style="font-family:system-ui,sans-serif;min-width:190px;font-size:13px;line-height:1.5;padding:2px 0">
          <b style="color:${track.technicianColor};font-size:14px">${track.technicianName}</b><br>
          <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle"></span>
          <b>${lbl}</b>${e.jobTitle ? ` · ${e.jobTitle}` : ""}<br>
          <span style="color:#64748b;font-size:11px">🕐 ${fmtTime(e.timestamp)}</span>
          ${e.address ? `<br><div style="font-size:11px;color:#374151;margin-top:4px;background:#f8fafc;padding:4px 6px;border-radius:4px">📍 ${e.address}</div>` : ""}
          <div style="font-size:10px;color:#94a3b8;margin-top:4px;font-family:monospace">${e.lat!.toFixed(5)}, ${e.lng!.toFixed(5)}</div>
        </div>`;

      marker.addListener("click", () => {
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
      });

      // Name label at day_start
      if (e.entryType === "day_start") {
        const label = new g.Marker({
          position: { lat: e.lat!, lng: e.lng! },
          map,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 0,
          },
          label: {
            text: track.technicianName.split(" ")[0],
            color: track.technicianColor,
            fontWeight: "700",
            fontSize: "11px",
          },
          zIndex: 20,
        });
        add(label);
      }
    }
  }

  if (allPoints.length === 0) {
    map.setCenter({ lat: 39.5, lng: -98.35 });
    map.setZoom(4);
  } else if (allPoints.length === 1) {
    map.setCenter(allPoints[0]);
    map.setZoom(18);
  } else {
    const bounds = new g.LatLngBounds();
    allPoints.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    g.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 18) map.setZoom(18);
    });
  }
}

export function TechnicianMap({ tracks, className, height = 320 }: TechnicianMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<GMap | null>(null);
  const infoRef      = useRef<google.maps.InfoWindow | null>(null);
  const tracksRef    = useRef(tracks);
  tracksRef.current  = tracks;

  useEffect(() => {
    if (!containerRef.current) return;
    let ro: ResizeObserver | null = null;

    loadMapsLib().then(() => {
      if (!containerRef.current || mapRef.current) return;
      const g = (window as any).google.maps;

      const map = new g.Map(containerRef.current, {
        mapTypeId: g.MapTypeId.HYBRID,   // satellite + roads + labels
        zoom: 4,
        center: { lat: 39.5, lng: -98.35 },
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
      });
      mapRef.current  = map;

      const infoWindow = new g.InfoWindow({ maxWidth: 280 });
      infoRef.current  = infoWindow;
      (map as any).__overlays = [];

      drawTracks(map, tracksRef.current, infoWindow);

      ro = new ResizeObserver(() => g.event.trigger(map, "resize"));
      ro.observe(containerRef.current!);
    }).catch(console.error);

    return () => {
      ro?.disconnect();
      if (mapRef.current) {
        (mapRef.current as any).__overlays?.forEach((o: any) => o.setMap(null));
        mapRef.current = null;
        infoRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current || !infoRef.current) return;
    drawTracks(mapRef.current, tracks, infoRef.current);
  }, [tracks]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: "100%", display: "block" }}
    />
  );
}

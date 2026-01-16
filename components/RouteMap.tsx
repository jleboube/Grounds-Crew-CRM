
import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Webpack/Vite
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom numbered marker icons
function createNumberedIcon(number: number, isFirst: boolean, isLast: boolean, isShop?: boolean): L.DivIcon {
  // Shop locations get a distinct blue color with a building icon
  if (isShop) {
    return L.divIcon({
      className: 'custom-shop-marker',
      html: `
        <div style="
          background-color: #2563eb;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
          box-shadow: 0 2px 10px rgba(37,99,235,0.4);
          border: 3px solid white;
        ">🏢</div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  }

  const bgColor = isFirst ? '#059669' : isLast ? '#0f172a' : '#10b981';

  return L.divIcon({
    className: 'custom-numbered-marker',
    html: `
      <div style="
        background-color: ${bgColor};
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">${number}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

export interface MapMarker {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  order?: number;
  isShop?: boolean;
}

interface RouteMapProps {
  markers: MapMarker[];
  showRoute?: boolean;
  height?: string;
}

// Component to handle map bounds fitting
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [markers, map]);

  return null;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  markers,
  showRoute = true,
  height = '100%'
}) => {
  // Default center (US center) if no markers
  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;

  // Calculate center from markers
  const center = useMemo(() => {
    if (markers.length === 0) return defaultCenter;
    const avgLat = markers.reduce((sum, m) => sum + m.lat, 0) / markers.length;
    const avgLng = markers.reduce((sum, m) => sum + m.lng, 0) / markers.length;
    return [avgLat, avgLng] as [number, number];
  }, [markers]);

  // Create route line coordinates
  const routeCoordinates = useMemo(() => {
    if (!showRoute || markers.length < 2) return [];
    return markers.map(m => [m.lat, m.lng] as [number, number]);
  }, [markers, showRoute]);

  return (
    <div style={{ height, width: '100%' }}>
      <MapContainer
        center={center}
        zoom={markers.length > 0 ? 12 : defaultZoom}
        style={{ height: '100%', width: '100%', borderRadius: '1.5rem' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route line */}
        {routeCoordinates.length >= 2 && (
          <Polyline
            positions={routeCoordinates}
            color="#059669"
            weight={4}
            opacity={0.8}
            dashArray="10, 10"
          />
        )}

        {/* Markers */}
        {markers.map((marker, index) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={createNumberedIcon(
              marker.order ?? index + 1,
              index === 0,
              index === markers.length - 1,
              marker.isShop
            )}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-slate-900">{marker.name}</p>
                <p className="text-slate-500 text-xs mt-1">{marker.address}</p>
                {marker.isShop ? (
                  <p className="text-blue-600 font-semibold text-xs mt-2">
                    {marker.id === 'shop-start' ? 'Route Start' : 'Route End'}
                  </p>
                ) : (
                  <p className="text-emerald-600 font-semibold text-xs mt-2">
                    Stop #{marker.order ?? index + 1}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Auto-fit bounds when markers change */}
        {markers.length > 0 && <FitBounds markers={markers} />}
      </MapContainer>
    </div>
  );
};

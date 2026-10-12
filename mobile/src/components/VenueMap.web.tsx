import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { levelStyle } from '../lib/occupancy';
import { colors } from '../theme';
import { DOT_SIZE, SELECTED_DOT_SIZE, type VenueMapProps } from './VenueMap.types';

// Leaflet zoom <-> react-native-maps style region (longitudeDelta in degrees)
const zoomForDelta = (delta: number) => Math.log2(360 / delta);

/** Web map (Leaflet + OpenStreetMap tiles); react-native-maps has no web support. */
export function VenueMap({
  initialRegion,
  venues,
  selectedId,
  onMarkerPress,
  onMapPress,
  onRegionChangeComplete,
  onSelectedPointChange,
}: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  // Latest props for Leaflet event handlers registered once
  const latest = useRef({ venues, selectedId, onMarkerPress, onMapPress, onRegionChangeComplete, onSelectedPointChange });
  latest.current = { venues, selectedId, onMarkerPress, onMapPress, onRegionChangeComplete, onSelectedPointChange };

  const reportSelectedPoint = () => {
    const map = mapRef.current;
    const { venues: list, selectedId: id, onSelectedPointChange: report } = latest.current;
    const venue = list.find((v) => v.id === id);
    if (!map || !venue) return;
    const point = map.latLngToContainerPoint([venue.lat, venue.lon]);
    report({ x: point.x, y: point.y });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      // Canvas with a tap tolerance makes small dots easy to hit on phones
      renderer: L.canvas({ tolerance: 12 }),
    }).setView([initialRegion.latitude, initialRegion.longitude], zoomForDelta(initialRegion.longitudeDelta));

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    map.on('click', () => latest.current.onMapPress());
    map.on('move', reportSelectedPoint);
    map.on('moveend', () => {
      const bounds = map.getBounds();
      const center = bounds.getCenter();
      latest.current.onRegionChangeComplete({
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: bounds.getNorth() - bounds.getSouth(),
        longitudeDelta: bounds.getEast() - bounds.getWest(),
      });
      reportSelectedPoint();
    });

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    // Report the first visible area like the native map does
    map.fire('moveend');

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later region changes come from the user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw dots when data or selection changes
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // Selected dot last so it is drawn on top
    const ordered = [...venues].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
    for (const venue of ordered) {
      const isSelected = venue.id === selectedId;
      L.circleMarker([venue.lat, venue.lon], {
        radius: (isSelected ? SELECTED_DOT_SIZE : DOT_SIZE) / 2,
        fillColor: levelStyle(venue.occupancy.level).color,
        fillOpacity: 1,
        color: isSelected ? colors.text : colors.white,
        weight: isSelected ? 4 : 3,
      })
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          latest.current.onMarkerPress(venue.id);
        })
        .addTo(layer);
    }
    onSelectedPointChange(null);
    reportSelectedPoint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, selectedId]);

  // zIndex + isolation keep Leaflet's internal z-indexes (400+) below our overlays
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }} />;
}

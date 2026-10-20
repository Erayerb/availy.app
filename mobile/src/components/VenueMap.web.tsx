import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { useSettings } from '../context/SettingsContext';
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
  focus,
  userPoint,
}: VenueMapProps) {
  const { crowdLook, colorBlind } = useSettings();
  const userLayerRef = useRef<L.CircleMarker | null>(null);
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

  useEffect(() => {
    if (focus && mapRef.current) mapRef.current.panTo([focus.lat, focus.lon]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  // Redraw dots when data or selection changes
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // Selected dot last so it is drawn on top
    const ordered = [...venues].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
    for (const venue of ordered) {
      const isSelected = venue.id === selectedId;
      const size = isSelected ? SELECTED_DOT_SIZE : DOT_SIZE;
      const { color, glyph } = crowdLook(venue);
      const border = isSelected ? `4px solid ${colors.text}` : `3px solid ${colors.white}`;
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${color};border:${border};box-shadow:0 1px 2px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:800 ${Math.round(size * 0.5)}px sans-serif">${glyph ?? ''}</div>`,
      });
      L.marker([venue.lat, venue.lon], { icon, zIndexOffset: isSelected ? 1000 : 0 })
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          latest.current.onMarkerPress(venue.id);
        })
        .addTo(layer);
    }
    onSelectedPointChange(null);
    reportSelectedPoint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, selectedId, colorBlind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userLayerRef.current?.remove();
    userLayerRef.current = userPoint
      ? L.circleMarker([userPoint.lat, userPoint.lon], {
          radius: 7,
          color: colors.white,
          weight: 3,
          fillColor: '#1A73E8',
          fillOpacity: 1,
          interactive: false,
        }).addTo(map)
      : null;
  }, [userPoint]);

  // zIndex + isolation keep Leaflet's internal z-indexes (400+) below our overlays
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }} />;
}

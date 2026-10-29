import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

import { useSettings } from '../context/SettingsContext';
import { clusterColor, clusterVenues, clusterZoomTarget } from '../lib/clusters';
import { UNEXPLORED_STYLE } from '../lib/occupancy';
import { LABEL_LINE_HEIGHT, LABEL_MAX_WIDTH, labelPriority, visibleLabels } from '../lib/labels';
import { colors, getScheme } from '../theme';
import { clusterSize, DOT_SIZE, LABEL_MIN_ZOOM, SELECTED_DOT_SIZE, zoomForDelta, type VenueMapProps } from './VenueMap.types';
import { ICON_FONT, iconChar } from './Icon';

/** Web map (Leaflet + OpenStreetMap tiles); react-native-maps has no web support. */
const USER_PANE = 'user';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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
  ownVenueId = null,
}: VenueMapProps) {
  const { crowdLook, colorBlind } = useSettings();
  const scheme = getScheme();
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Names under the dots once zoomed in to street level; which ones fit depends on the zoom
  const [zoom, setZoom] = useState(() => Math.round(zoomForDelta(initialRegion.longitudeDelta)));
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


    // The user's blue dot sits under the venue dots (Leaflet's marker pane is 600), so a venue
    // right where the user stands (e.g. one just added) is never hidden behind it
    const userPane = map.createPane(USER_PANE);
    userPane.style.zIndex = '450';
    userPane.style.pointerEvents = 'none';

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    map.on('zoomend', () => setZoom(map.getZoom()));
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

  // Map tiles: OpenStreetMap; in the dark theme the same tiles are darkened in the browser
  // (free, no API key; the dark tile services need one)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getPane('tilePane')!.style.filter =
      scheme !== 'light' ? 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.6)' : '';
  }, [scheme]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    if (focus.zoom) mapRef.current.setView([focus.lat, focus.lon], focus.zoom);
    else mapRef.current.panTo([focus.lat, focus.lon]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  // Redraw dots when data or selection changes
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const halo = colors.background;
    const labelled =
      zoom >= LABEL_MIN_ZOOM
        ? visibleLabels(labelPriority(venues, selectedId), (v) => map.latLngToContainerPoint([v.lat, v.lon]))
        : new Set<number>();
    // Close dots as one circle with a count; a tap zooms in until they split
    // The business's own venue is never in a cluster
    const own = venues.find((v) => v.id === ownVenueId);
    const items = [...clusterVenues(venues.filter((v) => v !== own), zoom, selectedId), ...(own ? [{ kind: 'venue' as const, venue: own }] : [])];
    for (const item of items) {
      if (item.kind !== 'cluster') continue;
      const size = clusterSize(item.venues.length);
      const color = clusterColor(item.venues, (v) => crowdLook(v).color, UNEXPLORED_STYLE.color);
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${color};border:3px solid ${colors.white};box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font:800 14px -apple-system,system-ui,sans-serif">${item.venues.length}</div>`,
      });
      L.marker([item.lat, item.lon], { icon })
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          const bounds = L.latLngBounds(item.venues.map((v) => [v.lat, v.lon] as [number, number]));
          const fit = map.getBoundsZoom(bounds, false, L.point(120, 120));
          map.setView(bounds.getCenter(), clusterZoomTarget(map.getZoom(), fit));
        })
        .addTo(layer);
    }
    const single = items.flatMap((i) => (i.kind === 'venue' ? [i.venue] : []));
    // Selected dot last so it is drawn on top
    const ordered = single.sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
    for (const venue of ordered) {
      const isSelected = venue.id === selectedId;
      const isOwn = venue.id === ownVenueId;
      const size = isSelected || isOwn ? SELECTED_DOT_SIZE : DOT_SIZE;
      const { color, glyph } = crowdLook(venue);
      const border = isSelected ? `4px solid ${colors.text}` : isOwn ? `5px solid ${colors.primary}` : `3px solid ${colors.white}`;
      const label = labelled.has(venue.id) || isOwn
        ? `<div style="position:absolute;left:${size + 3}px;top:50%;transform:translateY(-50%);width:max-content;max-width:${LABEL_MAX_WIDTH}px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 12px/${LABEL_LINE_HEIGHT}px -apple-system,system-ui,sans-serif;color:${isOwn ? colors.primary : color};text-shadow:0 0 2px ${halo},0 0 2px ${halo},0 0 3px ${halo};pointer-events:none">${escapeHtml(isOwn ? `Mekanın · ${venue.name}` : venue.name)}</div>`
        : '';
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<div style="position:relative;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${color};border:${border};box-shadow:0 1px 2px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:800 ${Math.round(size * 0.5)}px sans-serif">${glyph === '✨' ? `<span style="font-family:${ICON_FONT};font-weight:normal">${iconChar('sparkles')}</span>` : (glyph ?? '')}${label}</div>`,
      });
      L.marker([venue.lat, venue.lon], { icon, zIndexOffset: isSelected ? 1000 : isOwn ? 500 : 0 })
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          latest.current.onMarkerPress(venue.id);
        })
        .addTo(layer);
    }
    onSelectedPointChange(null);
    reportSelectedPoint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, selectedId, colorBlind, zoom, scheme, ownVenueId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userLayerRef.current?.remove();
    // Google Maps-style: light blue halo, blue dot with a white border
    userLayerRef.current = userPoint
      ? L.layerGroup([
          L.circleMarker([userPoint.lat, userPoint.lon], {
            radius: 20,
            stroke: false,
            fillColor: '#1A73E8',
            fillOpacity: 0.18,
            interactive: false,
            pane: USER_PANE,
          }),
          L.circleMarker([userPoint.lat, userPoint.lon], {
            radius: 8,
            color: colors.white,
            weight: 3,
            fillColor: '#1A73E8',
            fillOpacity: 1,
            interactive: false,
            pane: USER_PANE,
          }),
        ]).addTo(map)
      : null;
  }, [userPoint]);

  // zIndex + isolation keep Leaflet's internal z-indexes (400+) below our overlays
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }} />;
}

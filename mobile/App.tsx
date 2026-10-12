import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AboutScreen } from './src/components/AboutScreen';
import { MenuButton } from './src/components/MenuButton';
import { PlaceholderScreen } from './src/components/PlaceholderScreen';
import { Sidebar, type Screen } from './src/components/Sidebar';
import type { Venue } from './src/lib/api';
import type { Region } from './src/lib/bbox';
import type { Tag } from './src/lib/filters';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';

const DEFAULT_REGION: Region = {
  latitude: 41.03,
  longitude: 29.01,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// Zoom level used when opening a single venue on the map
const VENUE_ZOOM = 0.02;

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Purpose filters are shared by the home screen and the map
  const [tags, setTags] = useState<Tag[]>([]);
  // Remembered so the map reopens where the user left it
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const openMenu = () => setSidebarOpen(true);

  const openVenueOnMap = (venue: Venue) => {
    setMapRegion({
      latitude: venue.lat,
      longitude: venue.lon,
      latitudeDelta: VENUE_ZOOM,
      longitudeDelta: VENUE_ZOOM,
    });
    setSelectedId(venue.id);
    setScreen('map');
  };

  return (
    <View style={styles.container}>
      {screen === 'home' && (
        <HomeScreen tags={tags} onTagsChange={setTags} onMenu={openMenu} onOpenVenue={openVenueOnMap} />
      )}
      {screen === 'map' && (
        <MapScreen
          initialRegion={mapRegion}
          onRegionSaved={setMapRegion}
          tags={tags}
          onTagsChange={setTags}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBack={() => {
            setSelectedId(null);
            setScreen('home');
          }}
        />
      )}
      {screen === 'explore' && (
        <PlaceholderScreen
          title="Keşfet"
          text="Sana uygun, şu an sakin olan mekanların listesi burada olacak."
        />
      )}
      {screen === 'campaigns' && (
        <PlaceholderScreen
          title="Kampanyalar"
          text="Yakındaki mekanların boş saatlere özel kampanyaları burada görünecek."
        />
      )}
      {screen === 'about' && <AboutScreen />}

      {/* Home and map draw their own menu button; the simple pages share this one */}
      {(screen === 'explore' || screen === 'campaigns' || screen === 'about') && (
        <View style={styles.menu}>
          <MenuButton onPress={openMenu} />
        </View>
      )}

      <Sidebar
        open={sidebarOpen}
        current={screen}
        onSelect={(next) => {
          setScreen(next);
          setSelectedId(null);
          setSidebarOpen(false);
        }}
        onClose={() => setSidebarOpen(false)}
      />

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  menu: { position: 'absolute', top: 60, left: 12 },
});

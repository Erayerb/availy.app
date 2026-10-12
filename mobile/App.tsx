import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AboutScreen } from './src/components/AboutScreen';
import { MenuButton } from './src/components/MenuButton';
import { PlaceholderScreen } from './src/components/PlaceholderScreen';
import { Sidebar, type Screen } from './src/components/Sidebar';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { useAuth } from './src/hooks/useAuth';
import type { Venue } from './src/lib/api';
import type { Region } from './src/lib/bbox';
import { toggleSingle, type Tag } from './src/lib/filters';
import { AuthScreen } from './src/screens/AuthScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors } from './src/theme';

const DEFAULT_REGION: Region = {
  latitude: 41.03,
  longitude: 29.01,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// Zoom level used when opening a single venue on the map
const VENUE_ZOOM = 0.02;

// Before the main app: welcome page and the sign in / sign up forms
type Gate = 'welcome' | 'login' | 'register' | null;

export default function App() {
  const auth = useAuth();
  // The welcome page shows on every launch; signed-in users get a "continue" option there
  const [entered, setEntered] = useState(false);
  const [authForm, setAuthForm] = useState<'login' | 'register' | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Purpose filters are shared by the home screen and the map
  const [tags, setTags] = useState<Tag[]>([]);
  // Remembered so the map reopens where the user left it
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const gate: Gate = authForm ?? (entered ? null : 'welcome');

  const enterApp = () => {
    setAuthForm(null);
    setEntered(true);
    setScreen('home');
  };

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

  if (!auth.ready) {
    // Reading the stored session takes a moment; avoid flashing the welcome page
    return <View style={styles.container} />;
  }

  if (gate === 'welcome') {
    return (
      <>
        <WelcomeScreen
          user={auth.user}
          onContinue={enterApp}
          onSwitchAccount={async () => {
            await auth.logout();
            setAuthForm('login');
          }}
          onLogin={() => setAuthForm('login')}
          onRegister={() => setAuthForm('register')}
          onGuest={enterApp}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (gate === 'login' || gate === 'register') {
    return (
      <>
        <AuthScreen
          key={gate}
          mode={gate}
          onBack={() => setAuthForm(null)}
          onSwitchMode={setAuthForm}
          onLogin={async (email, password) => {
            const error = await auth.login(email, password);
            if (!error) enterApp();
            return error;
          }}
          onRegister={async (name, email, password) => {
            const error = await auth.register(name, email, password);
            if (!error) enterApp();
            return error;
          }}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
    <FavoritesProvider signedIn={auth.user !== null} onLoginRequired={() => setAuthForm('login')}>
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
            onMarkerPress={(id) => setSelectedId((current) => toggleSingle(current, id))}
            onBack={() => {
              setSelectedId(null);
              setScreen('home');
            }}
          />
        )}
        {screen === 'favorites' && <FavoritesScreen onMenu={openMenu} onOpenVenue={openVenueOnMap} />}
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

        {/* Home, map and favorites draw their own header; the simple pages share this button */}
        {(screen === 'explore' || screen === 'campaigns' || screen === 'about') && (
          <View style={styles.menu}>
            <MenuButton onPress={openMenu} />
          </View>
        )}

        <Sidebar
          open={sidebarOpen}
          current={screen}
          user={auth.user}
          onSelect={(next) => {
            setScreen(next);
            setSelectedId(null);
            setSidebarOpen(false);
          }}
          onLogin={() => {
            setSidebarOpen(false);
            setAuthForm('login');
          }}
          onLogout={async () => {
            setSidebarOpen(false);
            setEntered(false);
            await auth.logout();
          }}
          onClose={() => setSidebarOpen(false)}
        />

        <StatusBar style="dark" />
      </View>
    </FavoritesProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  menu: { position: 'absolute', top: 60, left: 12 },
});

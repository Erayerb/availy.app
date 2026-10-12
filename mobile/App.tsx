import { DancingScript_700Bold, useFonts } from '@expo-google-fonts/dancing-script';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AboutScreen } from './src/components/AboutScreen';
import { MenuButton } from './src/components/MenuButton';
import { Sidebar, type Screen } from './src/components/Sidebar';
import { CampaignsProvider } from './src/context/CampaignsContext';
import { EngagementProvider, useEngagement } from './src/context/EngagementContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { LocationProvider } from './src/context/LocationContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { useAuth } from './src/hooks/useAuth';
import { isBusiness, type Role } from './src/lib/auth';
import { DEFAULT_PLAN } from './src/lib/plans';
import { loadLocalVenues } from './src/lib/localVenueStore';
import { loadOverrides } from './src/lib/overrideStore';
import { BusinessMonitor } from './src/components/BusinessMonitor';
import type { Region } from './src/lib/bbox';
import { toggleSingle, type Tag } from './src/lib/filters';
import type { Side } from './src/lib/istanbul';
import { back, push, type History } from './src/lib/navigation';
import { searchVenues } from './src/lib/api';
import { venueFromQuery } from './src/lib/share';
import type { SortMode } from './src/lib/sort';
import { AuthScreen } from './src/screens/AuthScreen';
import { BusinessScreen } from './src/screens/BusinessScreen';
import { CampaignsScreen } from './src/screens/CampaignsScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { VenueDetailScreen } from './src/screens/VenueDetailScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { VenueSetupScreen } from './src/screens/VenueSetupScreen';
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

// Before the main app: welcome page, sign in / sign up forms, business venue setup
type Gate = 'welcome' | 'login' | 'register' | 'venueSetup' | null;

export default function App() {
  return (
    <SettingsProvider>
      <LocationProvider>
        <CampaignsProvider>
          <Main />
        </CampaignsProvider>
      </LocationProvider>
    </SettingsProvider>
  );
}

function Main() {
  const auth = useAuth();
  // Venues added by businesses on this phone must be loaded before the first data request
  const [localVenuesReady, setLocalVenuesReady] = useState(false);
  // Script font of the "availy" wordmark; continue anyway if it fails to load
  const [fontLoaded, fontError] = useFonts({ DancingScript_700Bold });
  // The welcome page shows on every launch; signed-in users get a "continue" option there
  const [entered, setEntered] = useState(false);
  const [authForm, setAuthForm] = useState<'login' | 'register' | null>(null);
  // Account type chosen on the welcome page, preselected on the form
  const [authRole, setAuthRole] = useState<Role>('personal');
  // Screen history: the map's back button returns to wherever the user came from
  const [nav, setNav] = useState<History<Screen>>({ current: 'home', stack: [] });
  const screen = nav.current;
  const goTo = (next: Screen) => setNav((h) => push(h, next));
  const goBack = () => setNav((h) => back(h, 'home'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Purpose filters are shared by the home screen and the map
  const [tags, setTags] = useState<Tag[]>([]);
  // Home search and "Konum" filter, kept here so they survive a trip to the map
  const [sides, setSides] = useState<Side[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  // Venue shown on the detail page
  const [detailId, setDetailId] = useState<number | null>(null);
  // Web: a shared link (?venue=Name) opens that venue after entering the app
  const [sharedVenue, setSharedVenue] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? venueFromQuery(window.location.search) : null,
  );
  // Remembered so the map reopens where the user left it
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([loadLocalVenues(), loadOverrides()]).finally(() => setLocalVenuesReady(true));
  }, []);

  const needsVenue = isBusiness(auth.user) && !auth.user?.venueId;
  const gate: Gate = authForm ?? (!entered ? 'welcome' : needsVenue ? 'venueSetup' : null);

  const enterApp = () => {
    setAuthForm(null);
    setEntered(true);
    setNav({ current: 'home', stack: [] });
  };

  const openMenu = () => setSidebarOpen(true);

  const openVenueOnMap = (venue: { id: number; lat: number; lon: number }) => {
    setMapRegion({
      latitude: venue.lat,
      longitude: venue.lon,
      latitudeDelta: VENUE_ZOOM,
      longitudeDelta: VENUE_ZOOM,
    });
    setSelectedId(venue.id);
    goTo('map');
  };

  const openDetails = (venue: { id: number }) => {
    setDetailId(venue.id);
    goTo('detail');
  };

  useEffect(() => {
    if (!sharedVenue || gate !== null) return;
    setSharedVenue(null);
    window.history.replaceState(null, '', window.location.pathname);
    searchVenues(sharedVenue, null, [])
      .then((found) => {
        const venue = found.find((v) => v.name === sharedVenue);
        if (venue) openVenueOnMap(venue);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedVenue, gate]);

  if (!auth.ready || !localVenuesReady || (!fontLoaded && !fontError)) {
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
          onLogin={(role) => {
            setAuthRole(role);
            setAuthForm('login');
          }}
          onRegister={(role) => {
            setAuthRole(role);
            setAuthForm('register');
          }}
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
          initialRole={authRole}
          onBack={() => setAuthForm(null)}
          onSwitchMode={setAuthForm}
          onLogin={async (email, password, role) => {
            const error = await auth.login(email, password, role);
            if (!error) enterApp();
            return error;
          }}
          onRegister={async (name, email, password, role) => {
            const error = await auth.register(name, email, password, role);
            if (!error) enterApp();
            return error;
          }}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (gate === 'venueSetup') {
    return (
      <>
        <VenueSetupScreen
          onDone={async (venueId) => {
            // A newly chosen venue has to be verified again
            await auth.updateProfile({ venueId, venueVerified: false });
            setNav({ current: 'business', stack: [] });
          }}
          onLogout={async () => {
            setEntered(false);
            await auth.logout();
          }}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
    <EngagementProvider userKey={auth.user?.email ?? 'guest'}>
      <FavoritesProvider signedIn={auth.user !== null} onLoginRequired={() => setAuthForm('login')}>
        <View style={styles.container}>
          {screen === 'home' && (
            <HomeScreen
              tags={tags}
              onTagsChange={setTags}
              sides={sides}
              onSidesChange={setSides}
              districts={districts}
              onDistrictsChange={setDistricts}
              query={query}
              onQueryChange={setQuery}
              sortMode={sortMode}
              onSortChange={setSortMode}
              onMenu={openMenu}
              onOpenVenue={openDetails}
            />
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
                goBack();
              }}
              onOpenDetails={openDetails}
            />
          )}
          {screen === 'business' && auth.user?.venueId && (
            <BusinessScreen
              venueId={auth.user.venueId}
              plan={auth.user.plan ?? DEFAULT_PLAN}
              verified={auth.user.venueVerified === true}
              onVerified={() => auth.updateProfile({ venueVerified: true })}
              onMenu={openMenu}
              onPlanChange={(plan) => auth.updateProfile({ plan })}
              onShowOnMap={openVenueOnMap}
            />
          )}
          {screen === 'favorites' && <FavoritesScreen onMenu={openMenu} onOpenVenue={openDetails} />}
          {screen === 'explore' && <ExploreScreen onMenu={openMenu} onOpenVenue={openDetails} />}
          {screen === 'detail' && detailId !== null && (
            <VenueDetailScreen
              venueId={detailId}
              userName={auth.user?.name ?? null}
              onLogin={() => setAuthForm('login')}
              onBack={goBack}
              onShowOnMap={openVenueOnMap}
            />
          )}
          {screen === 'profile' && (
            <ProfileScreen
              user={auth.user}
              onMenu={openMenu}
              onLogin={() => setAuthForm('login')}
              onRename={auth.rename}
              onChangePassword={auth.changePassword}
              onDeleteAccount={async () => {
                setEntered(false);
                await auth.deleteAccount();
              }}
              onLogout={async () => {
                setEntered(false);
                await auth.logout();
              }}
            />
          )}
          {screen === 'settings' && <SettingsScreen onMenu={openMenu} isBusiness={isBusiness(auth.user)} />}
          {screen === 'campaigns' && (
            <CampaignsScreen
              signedIn={auth.user !== null}
              business={
                isBusiness(auth.user) && auth.user?.venueId
                  ? {
                      venueId: auth.user.venueId,
                      plan: auth.user.plan ?? DEFAULT_PLAN,
                      verified: auth.user.venueVerified === true,
                      onPlanChange: (plan) => auth.updateProfile({ plan }),
                    }
                  : null
              }
              onLogin={() => setAuthForm('login')}
              onMenu={openMenu}
              onOpenVenue={(c) => openVenueOnMap({ id: c.venueId, lat: c.lat, lon: c.lon })}
            />
          )}
          {screen === 'about' && <AboutScreen />}

          {/* Most screens draw their own header; the simple pages share this button */}
          {screen === 'about' && (
            <View style={styles.menu}>
              <MenuButton onPress={openMenu} />
            </View>
          )}

          <Sidebar
            open={sidebarOpen}
            current={screen}
            user={auth.user}
            onSelect={(next) => {
              goTo(next);
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

          {isBusiness(auth.user) && auth.user?.venueId && (
            <BusinessMonitor venueId={auth.user.venueId} />
          )}
          <WatchAlert />
          <StatusBar style="dark" />
        </View>
      </FavoritesProvider>
    </EngagementProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  menu: { position: 'absolute', top: 60, left: 12 },
  alert: {
    position: 'absolute',
    top: 54,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.text,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  alertText: { flex: 1, color: colors.onPrimary, fontWeight: '600' },
  alertClose: { color: colors.onPrimary, fontSize: 16 },
});

/** In-app banner when a watched venue drops below 70% (also the only signal on web). */
function WatchAlert() {
  const { alert, dismissAlert } = useEngagement();
  if (!alert) return null;
  return (
    <Pressable style={styles.alert} onPress={dismissAlert}>
      <Text style={styles.alertText}>🔔 {alert}</Text>
      <Text style={styles.alertClose}>✕</Text>
    </Pressable>
  );
}

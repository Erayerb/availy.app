import * as Notifications from 'expo-notifications';
import {
  Figtree_300Light,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Figtree_900Black,
} from '@expo-google-fonts/figtree';
import { Tinos_400Regular, Tinos_700Bold, useFonts } from '@expo-google-fonts/tinos';
import { ICON_FONT, InlineIcon } from './src/components/Icon';
import { BadgeCelebration } from './src/components/BadgeCelebration';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Linking, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { Text } from './src/components/Text';
import { Pressable } from './src/components/Pressable';

import { Logo } from './src/components/Logo';
import { Wordmark } from './src/components/Wordmark';
import { useSettings } from './src/context/SettingsContext';
import { AboutScreen } from './src/screens/AboutScreen';
import { SocialScreen, type SocialTab } from './src/screens/SocialScreen';
import { CheckinScreen } from './src/screens/CheckinScreen';
import { useCheckinSuggestion } from './src/hooks/useCheckinSuggestion';
import { SuggestionBanner } from './src/components/SuggestionBanner';
import { HeaderActionsContext } from './src/components/HeaderButtons';
import { PermissionsScreen } from './src/screens/PermissionsScreen';
import { AppearanceScreen } from './src/screens/AppearanceScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { UserProfileScreen } from './src/screens/UserProfileScreen';
import { LevelsScreen } from './src/screens/LevelsScreen';
import type { Level } from './src/lib/safety';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { FirstCheckinSheet } from './src/components/FirstCheckinSheet';
import { InviteSheet } from './src/components/InviteSheet';
import { IntroOverlay } from './src/components/IntroOverlay';
import { friendsApi, inviteFromQuery } from './src/lib/friends';
import { venueIdFromDoorLink } from './src/lib/share';
import { listCodeFromQuery } from './src/lib/lists';
import { ListScreen } from './src/screens/ListScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { AddVenueScreen } from './src/screens/AddVenueScreen';
import { CustomersScreen } from './src/screens/CustomersScreen';
import { BUSINESS_TABS, CUSTOMER_TABS, TabBar, type Screen } from './src/components/TabBar';
import { CampaignsProvider } from './src/context/CampaignsContext';
import { LoyaltyProvider } from './src/context/LoyaltyContext';
import { EngagementProvider, useEngagement } from './src/context/EngagementContext';
import { SettingsProvider, SettingsSync } from './src/context/SettingsContext';
import { useLocation } from './src/context/LocationContext';
import { LocationProvider } from './src/context/LocationContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { useAuth } from './src/hooks/useAuth';
import { useVisits } from './src/hooks/useVisits';
import { accountKey, isBusiness, isRegistered, type Role } from './src/lib/auth';
import { DEFAULT_PLAN } from './src/lib/plans';
import { removeOldData } from './src/lib/cleanup';
import { isLocalVenueId } from './src/lib/localVenues';
import type { Region } from './src/lib/bbox';
import { toggleSingle, type Tag } from './src/lib/filters';
import type { Side } from './src/lib/istanbul';
import { back, push, type History, openPages } from './src/lib/navigation';
import { OfflineBar } from './src/components/OfflineBar';
import { ScreenStack } from './src/components/ScreenStack';
import { fetchVenuesByIds, searchVenues } from './src/lib/api';
import { venueFromQuery } from './src/lib/share';
import type { SortMode } from './src/lib/sort';
import { AuthScreen } from './src/screens/AuthScreen';
import { BusinessScreen } from './src/screens/BusinessScreen';
import { CampaignsScreen, type Tab as CampaignsTab } from './src/screens/CampaignsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { VenueDetailScreen } from './src/screens/VenueDetailScreen';
import { FavoritesScreen, type FavoritesTab } from './src/screens/FavoritesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { MapScreen } from './src/screens/MapScreen';
import { VenueSetupScreen } from './src/screens/VenueSetupScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, themed, setScheme, type Scheme } from './src/theme';

const DEFAULT_REGION: Region = {
  latitude: 41.03,
  longitude: 29.01,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// The map starts here around the user (or a business's own venue)
const NEAR_ZOOM = 0.03;

// Zoom level used when opening a single venue on the map
const VENUE_ZOOM = 0.02;

// Signed-in users see only the logo for this long before the app opens
const SPLASH_MS = 1000;

// First screen after entering: businesses start on their panel
// A page in the history, with what it was opened for
type Route = {
  name: Screen;
  id: number;
  detailId?: number;
  username?: string;
  list?: { id: number } | { code: string };
};
const sameRoute = (route: Route, name: Screen, params: Omit<Route, 'name' | 'id'>) =>
  route.name === name &&
  route.detailId === params.detailId &&
  route.username === params.username &&
  JSON.stringify(route.list) === JSON.stringify(params.list);

const landingFor = (role: Role): Screen => (role === 'business' ? 'business' : 'home');

// Before the main app: welcome page, sign in / sign up forms, business venue setup
type Gate = 'welcome' | 'login' | 'register' | 'venueSetup' | null;

export default function App() {
  return (
    <SettingsProvider>
      <LocationProvider>
        <Main />
      </LocationProvider>
    </SettingsProvider>
  );
}

function Main() {
  const auth = useAuth();
  // Tinos: the "availy" wordmark and headings; Figtree: all other text (components/Text); Tabler icons.
  // Continue anyway if they fail
  const [fontLoaded, fontError] = useFonts({
    [ICON_FONT]: require('./assets/fonts/tabler-icons.ttf'),
    Tinos_400Regular,
    Tinos_700Bold,
    Figtree_300Light,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Figtree_900Black,
  });
  // Signed-out users start on the welcome page; signed-in users see a short splash
  const [entered, setEntered] = useState(false);
  const [authForm, setAuthForm] = useState<'login' | 'register' | null>(null);
  // Account type chosen on the welcome page, preselected on the form
  const [authRole, setAuthRole] = useState<Role>('personal');
  // Screen history: the map's back button returns to wherever the user came from
  const [nav, setNav] = useState<History<Route>>({ current: { name: 'home', id: 0 }, stack: [] });
  const screen = nav.current.name;
  const routeId = useRef(0);
  const goTo = (next: Screen, params: Omit<Route, 'name' | 'id'> = {}) =>
    setNav((h) => (sameRoute(h.current, next, params) ? h : push(h, { name: next, id: ++routeId.current, ...params })));
  const visitedTabs = useRef(new Set<string>());
  const visitedFor = useRef<unknown>(null);
  const [topTick, setTopTick] = useState(0);
  // v2: a person's profile (mine from the top-right icon, others from names in Sosyal and reviews)
  const openProfile = (username: string) => goTo('user', { username });
  // v2: a venue list (Favoriler > Listelerim, a friend's profile, or a shared link)
  const openList = (id: number) => goTo('venueList', { list: { id } });
  // Guests have no public profile: they get the sign-up page instead
  const openMyProfile = () => {
    // A business's profile is its venue page, as customers see it
    if (isBusiness(auth.user) && auth.user?.venueId) return openDetails({ id: auth.user.venueId });
    if (isRegistered(auth.user) && auth.user?.username) return openProfile(auth.user.username);
    goTo('profile');
  };
  // Sosyal opens on Akış; a friend-request notification opens it on Arkadaşlar
  const [socialTab, setSocialTab] = useState<SocialTab>('feed');
  // Favoriler / Listelerim / Ziyaret edilenler: kept here so "back" from a list returns to the same tab
  const [favoritesTab, setFavoritesTab] = useState<FavoritesTab>('saved');
  // Kampanyalar opened on one of its tabs (Müşteriler > "Sadakat programı oluştur")
  const [campaignsTab, setCampaignsTab] = useState<CampaignsTab | null>(null);
  // Seviyeler: whose level to mark (the profile it was opened from)
  const [levelsFor, setLevelsFor] = useState<Level | null>(null);
  const role: Role = isBusiness(auth.user) ? 'business' : 'personal';
  const goBack = () => setNav((h) => back(h, { name: landingFor(role), id: 0 }));
  // Daha fazla: fresh points, profile steps and badges (a new photo or friend may have earned one)
  const { refreshMe } = auth;
  useEffect(() => {
    if (screen === 'more' && auth.user?.token && !isBusiness(auth.user)) refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  const { checkinSuggestions, appearance } = useSettings();
  // Görünüm: set the colors before any screen below reads them; a change re-renders everything
  const systemScheme = useColorScheme();
  const scheme: Scheme = appearance === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance;
  setScheme(scheme);
  const statusBar = scheme === 'light' ? 'dark' : 'light';
  const { point } = useLocation();
  // v2: venues the user checked in at (reloaded after each check-in, when the check-in count changes)
  const visits = useVisits(auth.user?.token, auth.user?.checkins);
  const visitedIds = useMemo(() => new Set(visits.map((v) => v.venue_id)), [visits]);
  // Home and map: hide venues that are closed right now
  const [hideClosed, setHideClosed] = useState(false);
  // Purpose filters are shared by the home screen and the map
  const [tags, setTags] = useState<Tag[]>([]);
  // Home search and "Konum" filter, kept here so they survive a trip to the map
  const [sides, setSides] = useState<Side[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  // Venue shown on the detail page
  // Web: a shared link (?venue=Name) opens that venue after entering the app
  const [sharedVenue, setSharedVenue] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? venueFromQuery(window.location.search) : null,
  );
  // Remembered so the map reopens where the user left it
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [mapKey, setMapKey] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    removeOldData(); // data earlier versions kept on the phone
  }, []);

  // A venue kept only on this phone (before venues were on the server) has to be chosen / added again
  const needsVenue = isBusiness(auth.user) && (!auth.user?.venueId || isLocalVenueId(auth.user.venueId));
  const gate: Gate = authForm ?? (!entered ? 'welcome' : needsVenue ? 'venueSetup' : null);

  const enterApp = (as: Role = 'personal') => {
    setAuthForm(null);
    setEntered(true);
    setNav({ current: { name: landingFor(as), id: 0 }, stack: [] });
  };

  const showSplash = gate === 'welcome' && auth.ready && auth.user !== null;
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => enterApp(role), SPLASH_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplash]);


  // Right after a new account: how-to slides, then (customers) "İlk check-in'in"
  // After sign-up: the intro, then (registered customers) inviting friends, then the first check-in
  const [onboarding, setOnboarding] = useState<'intro' | 'invite' | 'first' | null>(null);
  // v2: "Mado yakınındasın, burası şu an nasıl?" (customers, after the onboarding)
  const { suggestion, dismiss: dismissSuggestion } = useCheckinSuggestion(
    point,
    visits,
    checkinSuggestions && entered && auth.user !== null && !isBusiness(auth.user) && onboarding === null,
  );
  const startOnboarding = () => setOnboarding('intro');

  // Web: an invite link (?invite=eray) sends a friend request once the visitor has an account
  const [invite, setInvite] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? inviteFromQuery(window.location.search) : null,
  );
  useEffect(() => {
    if (!invite || gate !== null || !isRegistered(auth.user) || !auth.user?.token) return;
    const username = invite;
    setInvite(null);
    window.history.replaceState(null, '', window.location.pathname);
    friendsApi
      .add(auth.user.token, username)
      .then(() => goTo('friends'))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, gate, auth.user]);

  // Web: a shared list's link (?list=ABCD2345) opens it once there is a session (a guest's too)
  const [sharedList, setSharedList] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? listCodeFromQuery(window.location.search) : null,
  );
  useEffect(() => {
    if (!sharedList || gate !== null || !auth.user?.token) return;
    setSharedList(null);
    window.history.replaceState(null, '', window.location.pathname);
    goTo('venueList', { list: { code: sharedList } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedList, gate, auth.user]);

  const logout = async () => {
    setEntered(false);
    await auth.logout();
  };

  const openVenueOnMap = (venue: { id: number; lat: number; lon: number }) => {
    setMapRegion({
      latitude: venue.lat,
      longitude: venue.lon,
      latitudeDelta: VENUE_ZOOM,
      longitudeDelta: VENUE_ZOOM,
    });
    setSelectedId(venue.id);
    // Already on the map (its search): open it again around the venue, without a second history step
    setMapKey((k) => k + 1);
    if (screen !== 'map') goTo('map');
  };

  const openDetails = (venue: { id: number }) => {
    goTo('detail', { detailId: venue.id });
  };

  // The map starts nearby, not on the whole city; once it has been opened it keeps its own place
  const ownVenueId = isBusiness(auth.user) ? (auth.user?.venueId ?? null) : null;
  useEffect(() => {
    if (mapRegion !== DEFAULT_REGION || screen === 'map') return;
    const startAt = (latitude: number, longitude: number) =>
      setMapRegion((region) => (region === DEFAULT_REGION ? { latitude, longitude, latitudeDelta: NEAR_ZOOM, longitudeDelta: NEAR_ZOOM } : region));
    if (ownVenueId) {
      fetchVenuesByIds([ownVenueId]).then(([venue]) => venue && startAt(venue.lat, venue.lon)).catch(() => {});
    } else if (point) startAt(point.lat, point.lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.lat, point?.lon, ownVenueId, mapRegion]);

  // Tapping a phone notification: its venue, or the list of notifications
  const [tapped, setTapped] = useState<{ venueId?: number; list?: boolean } | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const take = (response: Notifications.NotificationResponse | null) => {
      if (response) setTapped(response.notification.request.content.data as { venueId?: number; list?: boolean });
    };
    // The tap that started the app, then the ones while it runs
    Notifications.getLastNotificationResponseAsync().then((response) => {
      take(response);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }).catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(take);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!tapped || gate !== null) return;
    setTapped(null);
    if (typeof tapped.venueId === 'number') {
      openDetails({ id: tapped.venueId });
      dismissSuggestion();
    } else if (tapped.list) goTo('notifications');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapped, gate]);

  // Android's back button goes through the same history as the arrows
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (nav.stack.length === 0) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  // The door QR (?kapi=123): on the web from the address; on the phone when the link opens the app
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const take = (url: string | null | undefined) => {
      const id = url ? venueIdFromDoorLink(url) : null;
      if (id !== null) setDoorVenue(id);
    };
    Linking.getInitialURL().then(take).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => take(url));
    return () => subscription.remove();
  }, []);
  const [doorVenue, setDoorVenue] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? venueIdFromDoorLink(window.location.search) : null,
  );
  useEffect(() => {
    if (doorVenue === null || gate !== null) return;
    setDoorVenue(null);
    window.history.replaceState(null, '', window.location.pathname);
    openDetails({ id: doorVenue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doorVenue, gate]);

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

  if (!auth.ready || (!fontLoaded && !fontError)) {
    // Reading the stored session takes a moment; avoid flashing the welcome page
    return <View style={styles.container} />;
  }

  if (showSplash) {
    return (
      <View style={[styles.container, styles.splash]}>
        <Logo />
        <Wordmark size={56} />
        <StatusBar style={statusBar} />
      </View>
    );
  }

  if (gate === 'welcome') {
    return (
      <>
        <WelcomeScreen
          onLogin={(role) => {
            setAuthRole(role);
            setAuthForm('login');
          }}
          onRegister={(role) => {
            setAuthRole(role);
            setAuthForm('register');
          }}
          onGuest={async () => {
            const error = await auth.continueAsGuest();
            if (!error) {
              enterApp('personal');
              startOnboarding();
            }
            return error;
          }}
        />
        <StatusBar style={statusBar} />
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
          onLogin={async (login, password, role, remember) => {
            const error = await auth.login(login, password, role, remember);
            if (!error) enterApp(role);
            return error;
          }}
          onRegister={async (username, email, password, role) => {
            // A guest who signs up has already been through the onboarding
            const wasGuest = auth.user?.isGuest === true;
            // Came through an invite link: friends with the inviter right away
            const error = await auth.register(username, email, password, role, invite);
            if (!error) {
              if (invite) {
                setInvite(null);
                if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname);
              }
              enterApp(role);
              // A guest who signs up has seen the intro; the invite step comes now
              if (role === 'personal') setOnboarding(wasGuest ? 'invite' : 'intro');
              else if (!wasGuest) startOnboarding();
            }
            return error;
          }}
        />
        <StatusBar style={statusBar} />
      </>
    );
  }

  if (gate === 'venueSetup') {
    return (
      <>
        <VenueSetupScreen
          token={auth.user?.token ?? null}
          onDone={async (venueId) => {
            // A newly chosen venue has to be verified again
            await auth.updateProfile({ venueId, venueVerified: false });
            setNav({ current: { name: 'business', id: 0 }, stack: [] });
          }}
          onLogout={async () => {
            setEntered(false);
            await auth.logout();
          }}
        />
        <StatusBar style={statusBar} />
      </>
    );
  }

  // Profil ayarları (customers) and Ayarlar (businesses)
  const accountActions = {
    onChangeUsername: auth.changeUsername,
    onChangePassword: auth.changePassword,
    onChangeEmail: async (email: string, password: string) => {
      const error = await auth.changeEmail(email, password);
      // The screen reloads for the new e-mail's data, so confirm with a dialog that stays
      if (!error) notifyDone(`E-posta adresin ${email.trim().toLowerCase()} olarak değişti.`);
      return error;
    },
    onDeleteAccount: async () => {
      setEntered(false);
      await auth.deleteAccount();
    },
    onFreezeAccount: async () => {
      setEntered(false);
      await auth.freezeAccount();
    },
  };


  const tabs = isBusiness(auth.user) ? BUSINESS_TABS : CUSTOMER_TABS;
  const tabNames: string[] = tabs.map((t) => t.screen);
  // Each page with what it was opened for: a page behind another keeps its own venue or person
  const renderRoute = (route: Route) => {
    const screen = route.name;
    const detailId = route.detailId ?? null;
    const profileUsername = route.username ?? null;
    const openedList = route.list ?? null;
    return (
      <>
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
              hideClosed={hideClosed}
              onHideClosedChange={setHideClosed}
              onOpenVenue={openDetails}
              onOpenProfile={openMyProfile}
              onOpenNotifications={() => goTo('notifications')}
            />
          )}
          {screen === 'map' && (
            <MapScreen
              key={mapKey}
              onShowVenue={openVenueOnMap}
              friendsToken={isRegistered(auth.user) && !isBusiness(auth.user) ? (auth.user?.token ?? null) : null}
              initialRegion={mapRegion}
              onRegionSaved={setMapRegion}
              tags={tags}
              onTagsChange={setTags}
              hideClosed={hideClosed}
              onHideClosedChange={setHideClosed}
              visitedIds={visitedIds}
              onOpenCheckin={() => goTo('checkin')}
              ownVenueId={isBusiness(auth.user) ? (auth.user?.venueId ?? null) : null}
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
              user={auth.user}
              onShowOnMap={openVenueOnMap}
              onOpenUser={openProfile}
              onRegister={() => setAuthForm('register')}
              onEditProfile={() => goTo('profile')}
              onUpgrade={() => goTo('subscription')}
            />
          )}
          {screen === 'customers' && auth.user?.venueId && (
            <CustomersScreen
              venueId={auth.user.venueId}
              user={auth.user}
              onOpenUser={openProfile}
              onRegister={() => setAuthForm('register')}
              onOpenLoyalty={() => {
                setCampaignsTab('myPrograms');
                goTo('campaigns');
              }}
            />
          )}
          {screen === 'favorites' && (
            <FavoritesScreen
              onOpenVenue={openDetails}
              visits={visits}
              signedIn={isRegistered(auth.user)}
              token={auth.user?.token ?? null}
              onOpenList={openList}
              tab={favoritesTab}
              onTabChange={setFavoritesTab}
              onLogin={() => setAuthForm('login')}
              onRegister={() => {
                setAuthRole('personal');
                setAuthForm('register');
              }}
            />
          )}
          {screen === 'detail' && detailId !== null && (
            <VenueDetailScreen
              venueId={detailId}
              user={auth.user}
              onRegister={() => {
                setAuthRole('personal');
                setAuthForm('register');
              }}
              onCheckedIn={auth.refreshMe}
              onLogin={() => setAuthForm('login')}
              onBack={goBack}
              onShowOnMap={openVenueOnMap}
              onOpenUser={openProfile}
              onEditProfile={() => goTo('profile')}
              lastCheckinAt={visits.find((v) => v.venue_id === detailId)?.last_at ?? null}
            />
          )}
          {screen === 'profile' && (
            <ProfileScreen
              user={auth.user}
              onBack={goBack}
              onLogin={() => setAuthForm('login')}
              onRegister={() => {
                setAuthRole('personal');
                setAuthForm('register');
              }}
              {...accountActions}
              onSendVerification={auth.sendVerification}
              onVerifyEmail={auth.verifyEmail}
              onOpenMyProfile={openMyProfile}
              onOpenVerification={() => goTo('verification')}
            />
          )}
          {screen === 'settings' && (
            <SettingsScreen
              onBack={goBack}
              isBusiness={isBusiness(auth.user)}
              guest={!auth.user || auth.user.isGuest === true}
              venueId={isBusiness(auth.user) ? (auth.user?.venueId ?? null) : null}
              account={auth.user && isBusiness(auth.user) ? { user: auth.user, ...accountActions } : null}
            />
          )}
          {screen === 'campaigns' && (
            <CampaignsScreen
              initialTab={campaignsTab ?? undefined}
              onTabChange={setCampaignsTab}
              signedIn={isRegistered(auth.user)}
              serverPoints={auth.user?.points ?? 0}
              customerCode={auth.user?.customerCode ?? null}
              business={
                isBusiness(auth.user) && auth.user?.venueId
                  ? {
                      venueId: auth.user.venueId,
                      plan: auth.user.plan ?? DEFAULT_PLAN,
                      onPlanChange: (plan) => auth.updateProfile({ plan }),
                    }
                  : null
              }
              onLogin={() => setAuthForm('login')}
              onOpenVenue={(c) => openVenueOnMap({ id: c.venueId, lat: c.lat, lon: c.lon })}
              onBack={isBusiness(auth.user) ? undefined : goBack}
            />
          )}
          {screen === 'permissions' && (
            <PermissionsScreen business={isBusiness(auth.user)} onBack={goBack} />
          )}
          {screen === 'appearance' && <AppearanceScreen onBack={goBack} />}
          {screen === 'privacy' && (
            <PrivacyScreen
              token={isRegistered(auth.user) ? (auth.user?.token ?? null) : null}
              onBack={goBack}
              onOpenPermissions={() => goTo('permissions')}
              onOpenLegal={() => goTo('legal')}
            />
          )}
          {screen === 'legal' && <LegalScreen initial="terms" onBack={goBack} />}
          {screen === 'levels' && <LevelsScreen current={levelsFor?.id ?? null} next={levelsFor?.next} onBack={goBack} />}
          {screen === 'admin' && auth.user?.token && <AdminScreen token={auth.user.token} onBack={goBack} onOpenVenue={openDetails} />}
          {screen === 'venueList' && openedList && auth.user?.token && (
            <ListScreen
              key={'id' in openedList ? `id-${openedList.id}` : `code-${openedList.code}`}
              token={auth.user.token}
              target={openedList}
              onBack={goBack}
              onOpenVenue={openDetails}
              onOpenList={openList}
            />
          )}
          {screen === 'user' && profileUsername && auth.user?.token && (
            <UserProfileScreen
              key={profileUsername}
              token={auth.user.token}
              username={profileUsername}
              onBack={goBack}
              onOpenVenue={openDetails}
              onOpenSettings={() => goTo('profile')}
              onOpenList={openList}
              onOpenLevels={(level) => {
                setLevelsFor(level);
                goTo('levels');
              }}
            />
          )}
          {screen === 'notifications' && (
            <NotificationsScreen
              signedIn={isRegistered(auth.user)}
              onBack={goBack}
              onRegister={() => {
                setAuthRole('personal');
                setAuthForm('register');
              }}
              onOpenVenue={openDetails}
              onOpenFeed={() => {
                setSocialTab('feed');
                goTo('friends');
              }}
              onOpenFriends={() => {
                setSocialTab('friends');
                goTo('friends');
              }}
              onOpenRanking={() => {
                setSocialTab('ranking');
                goTo('friends');
              }}
              onOpenSettings={() => goTo('settings')}
            />
          )}
          {screen === 'checkin' && <CheckinScreen onBack={goBack} onOpenVenue={openDetails} onAddVenue={() => goTo('addVenue')} visits={visits} />}
          {screen === 'addVenue' && (
            <AddVenueScreen
              user={auth.user}
              onBack={goBack}
              onRegister={() => {
                setAuthRole('personal');
                setAuthForm('register');
              }}
              onAdded={openDetails}
            />
          )}
          {screen === 'about' && <AboutScreen role={role} onBack={goBack} />}
          {screen === 'support' && <SupportScreen email={auth.user?.email ?? null} token={auth.user?.token ?? null} onBack={goBack} />}
          {screen === 'verification' && <VerificationScreen onBack={goBack} />}
          {screen === 'friends' && (
            <SocialScreen
              initialTab={socialTab}
              onTabChange={setSocialTab}
              user={auth.user}
              onOpenVenue={openDetails}
              onOpenProfile={openMyProfile}
              onOpenNotifications={() => goTo('notifications')}
              onOpenUser={openProfile}
              onOpenMap={() => goTo('map')}
              onOpenCheckin={() => goTo('checkin')}
              onRegister={() => {
                setAuthRole('personal');
                setAuthForm('register');
              }}
            />
          )}
          {screen === 'subscription' && (
            <SubscriptionScreen
              signedIn={isRegistered(auth.user)}
              onBack={goBack}
              onLogin={() => setAuthForm('login')}
              business={
                isBusiness(auth.user)
                  ? { plan: auth.user?.plan ?? DEFAULT_PLAN, onPlanChange: (plan) => auth.updateProfile({ plan }) }
                  : null
              }
            />
          )}
          {screen === 'more' && (
            <MoreScreen
              user={auth.user}
              onSelect={goTo}
              onLogin={() => setAuthForm('login')}
              onRegister={() => setAuthForm('register')}
              onLogout={logout}
            />
          )}
      </>
    );
  };
  // Open pages belong to one account
  if (visitedFor.current !== accountKey) {
    visitedFor.current = accountKey;
    visitedTabs.current = new Set();
  }
  visitedTabs.current.add(landingFor(role));
  if (tabNames.includes(screen)) visitedTabs.current.add(screen);
  const open = openPages(nav, tabNames, [...visitedTabs.current]);
  const pages = open.map(({ key, route }) => ({ key, element: renderRoute(route) }));
  const activeKey = open.find((p) => (p.route.id === nav.current.id && p.route.name === screen) || p.key === `tab:${screen}`)?.key ?? '';
  const behind = nav.stack[nav.stack.length - 1] ?? { name: landingFor(role), id: 0 };
  const backKey = tabNames.includes(behind.name) ? `tab:${behind.name}` : `page:${behind.id}`;

  return (
    <EngagementProvider
      // A new key (e.g. a changed e-mail) loads that account's data again
      key={auth.user ? accountKey(auth.user) : 'guest'}
      userKey={auth.user ? accountKey(auth.user) : 'guest'}
      token={isRegistered(auth.user) ? (auth.user?.token ?? null) : null}
    >
      <SettingsSync token={isRegistered(auth.user) ? (auth.user?.token ?? null) : null} />
      <CampaignsProvider token={auth.user?.token ?? null} business={isBusiness(auth.user)}>
      <LoyaltyProvider token={auth.user?.token ?? null} business={isBusiness(auth.user)}>
      <FavoritesProvider
        accountKey={auth.user ? accountKey(auth.user) : null}
        token={isRegistered(auth.user) ? (auth.user?.token ?? null) : null}
        signedIn={isRegistered(auth.user)} onLoginRequired={() => setAuthForm('login')}>
      <NotificationsProvider
        token={isRegistered(auth.user) ? (auth.user?.token ?? null) : null}
        accountKey={auth.user ? accountKey(auth.user) : null}
      >
      <HeaderActionsContext.Provider
        value={{ onOpenProfile: openMyProfile, onOpenNotifications: () => goTo('notifications') }}
      >
        <View style={styles.container}>
          <OfflineBar />
          {/* Screens fill the space above the bottom tab bar */}
          <ScreenStack
            pages={pages}
            activeKey={activeKey}
            backKey={backKey}
            swipeEnabled={screen !== 'map' && !tabNames.includes(screen)}
            depth={nav.stack.length}
            topTick={topTick}
            onBack={goBack}
          />

          <TabBar
            tabs={tabs}
            current={screen}
            onSelect={(next) => {
              // The tab already open: back to the top of its list
              if (next === screen) setTopTick((n) => n + 1);
              else goTo(next);
              setSelectedId(null);
            }}
          />

          <WatchAlert />
          {suggestion && !(screen === 'detail' && nav.current.detailId === suggestion.venue.id) && (
            <SuggestionBanner
              suggestion={suggestion}
              onCheckin={() => {
                openDetails(suggestion.venue);
                dismissSuggestion();
              }}
              onClose={dismissSuggestion}
            />
          )}
          {/* "Yeni rozet!" wherever the user is (badges from a check-in, a photo, a friend…) */}
          <BadgeCelebration />
          {onboarding === 'intro' && (
            <IntroOverlay
              role={role}
              onDone={() => setOnboarding(role === 'business' ? null : isRegistered(auth.user) && auth.user?.username ? 'invite' : 'first')}
            />
          )}
          {onboarding === 'invite' && auth.user?.username && (
            <InviteSheet
              username={auth.user.username}
              onFindContacts={() => {
                setOnboarding(null);
                setSocialTab('friends');
                goTo('friends');
              }}
              onDone={() => setOnboarding('first')}
            />
          )}
          {onboarding === 'first' && (
            <FirstCheckinSheet
              onFound={openDetails}
              onDone={(venue) => {
                setOnboarding(null);
                if (!venue) goTo('map');
              }}
            />
          )}
          <StatusBar style={statusBar} />
        </View>
      </HeaderActionsContext.Provider>
      </NotificationsProvider>
      </FavoritesProvider>
      </LoyaltyProvider>
      </CampaignsProvider>
    </EngagementProvider>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  splash: { alignItems: 'center', justifyContent: 'center', gap: 14 },
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
  // Inverse of the page: dark banner in the light theme, light banner in the dark theme
  alertText: { flex: 1, color: colors.background, fontWeight: '600' },
  alertClose: { color: colors.background, fontSize: 16 },
}));

/** A short "done" message that stays on screen (web: the browser's dialog). */
function notifyDone(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Tamam', message);
}

/** In-app banner when a watched venue drops below 70% (also the only signal on web). */
function WatchAlert() {
  const { alert, dismissAlert } = useEngagement();
  if (!alert) return null;
  return (
    <Pressable style={styles.alert} onPress={dismissAlert}>
      <Text style={styles.alertText}><InlineIcon name="bell" /> {alert}</Text>
      <Text style={styles.alertClose}>✕</Text>
    </Pressable>
  );
}

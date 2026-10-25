import { DancingScript_700Bold, useFonts } from '@expo-google-fonts/dancing-script';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

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
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { FirstCheckinSheet } from './src/components/FirstCheckinSheet';
import { IntroOverlay } from './src/components/IntroOverlay';
import { friendsApi, inviteFromQuery } from './src/lib/friends';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { AddVenueScreen } from './src/screens/AddVenueScreen';
import { CustomersScreen } from './src/screens/CustomersScreen';
import { BUSINESS_TABS, CUSTOMER_TABS, TabBar, type Screen } from './src/components/TabBar';
import { CampaignsProvider } from './src/context/CampaignsContext';
import { LoyaltyProvider } from './src/context/LoyaltyContext';
import { EngagementProvider, useEngagement } from './src/context/EngagementContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { useLocation } from './src/context/LocationContext';
import { LocationProvider } from './src/context/LocationContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { useAuth } from './src/hooks/useAuth';
import { useVisits } from './src/hooks/useVisits';
import { accountKey, isBusiness, isRegistered, type Role } from './src/lib/auth';
import { DEFAULT_PLAN } from './src/lib/plans';
import { removeOldData } from './src/lib/cleanup';
import { isLocalVenueId } from './src/lib/localVenues';
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
import { CampaignsScreen, type Tab as CampaignsTab } from './src/screens/CampaignsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { VenueDetailScreen } from './src/screens/VenueDetailScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
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

// Zoom level used when opening a single venue on the map
const VENUE_ZOOM = 0.02;

// Signed-in users see only the logo for this long before the app opens
const SPLASH_MS = 1000;

// First screen after entering: businesses start on their panel
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
  // Venues added by businesses on this phone must be loaded before the first data request
  const [localVenuesReady, setLocalVenuesReady] = useState(false);
  // Script font of the "availy" wordmark; continue anyway if it fails to load
  const [fontLoaded, fontError] = useFonts({ DancingScript_700Bold });
  // Signed-out users start on the welcome page; signed-in users see a short splash
  const [entered, setEntered] = useState(false);
  const [authForm, setAuthForm] = useState<'login' | 'register' | null>(null);
  // Account type chosen on the welcome page, preselected on the form
  const [authRole, setAuthRole] = useState<Role>('personal');
  // Screen history: the map's back button returns to wherever the user came from
  const [nav, setNav] = useState<History<Screen>>({ current: 'home', stack: [] });
  const screen = nav.current;
  const goTo = (next: Screen) => setNav((h) => push(h, next));
  // v2: a person's profile (mine from the top-right icon, others from names in Sosyal and reviews)
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const openProfile = (username: string) => {
    setProfileUsername(username);
    goTo('user');
  };
  // Guests have no public profile: they get the sign-up page instead
  const openMyProfile = () => {
    // A business's profile is its venue page, as customers see it
    if (isBusiness(auth.user) && auth.user?.venueId) return openDetails({ id: auth.user.venueId });
    if (isRegistered(auth.user) && auth.user?.username) return openProfile(auth.user.username);
    goTo('profile');
  };
  // Sosyal opens on Akış; a friend-request notification opens it on Arkadaşlar
  const [socialTab, setSocialTab] = useState<SocialTab>('feed');
  // Kampanyalar opened on one of its tabs (Müşteriler > "Sadakat programı oluştur")
  const [campaignsTab, setCampaignsTab] = useState<CampaignsTab | null>(null);
  const role: Role = isBusiness(auth.user) ? 'business' : 'personal';
  const goBack = () => setNav((h) => back(h, landingFor(role)));
  const { checkinSuggestions, appearance } = useSettings();
  // Görünüm: set the colors before any screen below reads them; a change re-renders everything
  const systemScheme = useColorScheme();
  const scheme: Scheme = appearance === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance;
  setScheme(scheme);
  const statusBar = scheme === 'dark' ? 'light' : 'dark';
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
  const [detailId, setDetailId] = useState<number | null>(null);
  // Web: a shared link (?venue=Name) opens that venue after entering the app
  const [sharedVenue, setSharedVenue] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? venueFromQuery(window.location.search) : null,
  );
  // Remembered so the map reopens where the user left it
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [mapKey, setMapKey] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([loadLocalVenues(), loadOverrides()]).finally(() => setLocalVenuesReady(true));
    removeOldData(); // data earlier versions kept on the phone
  }, []);

  // A venue kept only on this phone (before venues were on the server) has to be chosen / added again
  const needsVenue = isBusiness(auth.user) && (!auth.user?.venueId || isLocalVenueId(auth.user.venueId));
  const gate: Gate = authForm ?? (!entered ? 'welcome' : needsVenue ? 'venueSetup' : null);

  const enterApp = (as: Role = 'personal') => {
    setAuthForm(null);
    setEntered(true);
    setNav({ current: landingFor(as), stack: [] });
  };

  const showSplash = gate === 'welcome' && auth.ready && auth.user !== null;
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => enterApp(role), SPLASH_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplash]);


  // Right after a new account: how-to slides, then (customers) "İlk check-in'in"
  const [onboarding, setOnboarding] = useState<'intro' | 'first' | null>(null);
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
              if (!wasGuest) startOnboarding();
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
            setNav({ current: 'business', stack: [] });
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

  return (
    <EngagementProvider
      // A new key (e.g. a changed e-mail) loads that account's data again
      key={auth.user ? accountKey(auth.user) : 'guest'}
      userKey={auth.user ? accountKey(auth.user) : 'guest'}
    >
      <CampaignsProvider token={auth.user?.token ?? null} business={isBusiness(auth.user)}>
      <LoyaltyProvider token={auth.user?.token ?? null} business={isBusiness(auth.user)}>
      <FavoritesProvider
        accountKey={auth.user ? accountKey(auth.user) : null}
        signedIn={isRegistered(auth.user)} onLoginRequired={() => setAuthForm('login')}>
      <NotificationsProvider
        token={isRegistered(auth.user) ? (auth.user?.token ?? null) : null}
        accountKey={auth.user ? accountKey(auth.user) : null}
      >
      <HeaderActionsContext.Provider
        value={{ onOpenProfile: openMyProfile, onOpenNotifications: () => goTo('notifications') }}
      >
        <View style={styles.container}>
          {/* Screens fill the space above the bottom tab bar */}
          <View style={styles.screen}>
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
              venueId={isBusiness(auth.user) ? (auth.user?.venueId ?? null) : null}
              account={auth.user && isBusiness(auth.user) ? { user: auth.user, ...accountActions } : null}
            />
          )}
          {screen === 'campaigns' && (
            <CampaignsScreen
              key={campaignsTab ?? 'default'}
              initialTab={campaignsTab ?? undefined}
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
          {screen === 'user' && profileUsername && auth.user?.token && (
            <UserProfileScreen
              key={profileUsername}
              token={auth.user.token}
              username={profileUsername}
              onBack={goBack}
              onOpenVenue={openDetails}
              onOpenSettings={() => goTo('profile')}
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
          {screen === 'checkin' && <CheckinScreen onBack={goBack} onOpenVenue={openDetails} onAddVenue={() => goTo('addVenue')} />}
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
              key={socialTab}
              initialTab={socialTab}
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
              onLogout={logout}
            />
          )}
          </View>

          <TabBar
            tabs={isBusiness(auth.user) ? BUSINESS_TABS : CUSTOMER_TABS}
            current={screen}
            onSelect={(next) => {
              if (next === 'friends') setSocialTab('feed');
              if (next === 'campaigns') setCampaignsTab(null);
              goTo(next);
              setSelectedId(null);
            }}
          />

          {isBusiness(auth.user) && auth.user?.venueId && (
            <BusinessMonitor venueId={auth.user.venueId} />
          )}
          <WatchAlert />
          {suggestion && !(screen === 'detail' && detailId === suggestion.venue.id) && (
            <SuggestionBanner
              suggestion={suggestion}
              onCheckin={() => {
                openDetails(suggestion.venue);
                dismissSuggestion();
              }}
              onClose={dismissSuggestion}
            />
          )}
          {onboarding === 'intro' && (
            <IntroOverlay role={role} onDone={() => setOnboarding(role === 'business' ? null : 'first')} />
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
      <Text style={styles.alertText}>🔔 {alert}</Text>
      <Text style={styles.alertClose}>✕</Text>
    </Pressable>
  );
}

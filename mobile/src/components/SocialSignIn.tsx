import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { accountApi, type SocialProvider } from '../lib/accountApi';
import { colors, isDarkScheme, themed } from '../theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

// The web sign-in opens Google in a pop-up; this closes it and hands the answer back
WebBrowser.maybeCompleteAuthSession();

// Our app's ids at Google, one per platform (Google Cloud > APIs & Services > Credentials).
// Not secret; they go in mobile/.env as EXPO_PUBLIC_GOOGLE_*_CLIENT_ID.
const GOOGLE_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
};
const googleIdHere = Platform.OS === 'ios' ? GOOGLE_IDS.ios : Platform.OS === 'android' ? GOOGLE_IDS.android : GOOGLE_IDS.web;

type Props = {
  // The provider's ID token (and the name Apple gives on the first sign-in); returns an error or null
  onToken: (provider: SocialProvider, idToken: string, name: string) => Promise<string | null>;
};

/**
 * "Apple ile devam et" / "Google ile devam et" above the e-mail form. Each button shows only when it is
 * set up on the server and in the app, so nothing half-working appears before the ids are added.
 */
export function SocialSignIn({ onToken }: Props) {
  const [enabled, setEnabled] = useState<SocialProvider[]>([]);
  const [apple, setApple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    accountApi.providers().then((r) => setEnabled(r.providers)).catch(() => {});
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setApple).catch(() => {});
  }, []);

  const finish = async (provider: SocialProvider, token: string | null | undefined, name = '') => {
    if (!token) return;
    setBusy(true);
    setError(await onToken(provider, token, name));
    setBusy(false);
  };

  const signInWithApple = async () => {
    try {
      const result = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      const name = [result.fullName?.givenName, result.fullName?.familyName].filter(Boolean).join(' ');
      await finish('apple', result.identityToken, name);
    } catch (e) {
      // Closing Apple's sheet is not an error
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setError('Apple ile giriş yapılamadı, tekrar dene.');
    }
  };

  const showApple = apple && enabled.includes('apple');
  const showGoogle = !!googleIdHere && enabled.includes('google');
  if (!showApple && !showGoogle) return null;

  return (
    <View style={styles.box} pointerEvents={busy ? 'none' : 'auto'}>
      {showApple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            isDarkScheme() ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={12}
          style={styles.apple}
          onPress={signInWithApple}
        />
      )}
      {showGoogle && <GoogleButton onToken={(token) => finish('google', token)} onError={setError} />}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.orRow}>
        <View style={styles.line} />
        <Text style={styles.or}>ya da e-postayla</Text>
        <View style={styles.line} />
      </View>
    </View>
  );
}

/** Its own component: Google's hook needs this platform's client id, so it only runs when there is one. */
function GoogleButton({ onToken, onError }: { onToken: (idToken: string) => void; onError: (message: string) => void }) {
  const [request, response, prompt] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_IDS.web || undefined,
    iosClientId: GOOGLE_IDS.ios || undefined,
    androidClientId: GOOGLE_IDS.android || undefined,
  });

  useEffect(() => {
    if (response?.type === 'success') onToken(response.params.id_token);
    else if (response?.type === 'error') onError('Google ile giriş yapılamadı, tekrar dene.');
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pressable
      onPress={() => prompt()}
      disabled={!request}
      style={({ pressed }) => [styles.google, pressed && styles.pressed, !request && styles.disabled]}
      accessibilityRole="button"
    >
      <GoogleLogo />
      <Text style={styles.googleText}>Google ile devam et</Text>
    </Pressable>
  );
}

/** Google's four-colour "G" (their sign-in button guidelines ask for the logo as is). */
function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { gap: 10 },
  apple: { height: 48, width: '100%' },
  google: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  googleText: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  error: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { fontSize: 13, color: colors.textMuted },
}));

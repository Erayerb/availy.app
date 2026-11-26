// Extends app.json. The GitHub Pages build serves the web app under /availy.app,
// so it sets EXPO_BASE_URL; Expo Go and local development leave it unset.
// The Android build's map is Google Maps and needs a key (Google Cloud > Maps SDK for Android, restricted to
// the app); Expo Go brings its own, so it is only needed for the store build: GOOGLE_MAPS_ANDROID_API_KEY.
const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
  android: {
    ...config.android,
    ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
  },
});

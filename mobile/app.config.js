// Extends app.json. The GitHub Pages build serves the web app under /availy.app,
// so it sets EXPO_BASE_URL; Expo Go and local development leave it unset.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});

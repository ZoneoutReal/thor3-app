// Dynamic Expo config. Keeps app.json as the source of truth and only injects a
// web `baseUrl` when EXPO_BASE_URL is set (production web export for GitHub Pages,
// served from a project subpath). Local dev / the tunnel run without EXPO_BASE_URL,
// so they stay served from "/" and are unaffected. Mirrors Rallo's app.config.js.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments || {}),
    ...(process.env.EXPO_BASE_URL
      ? { baseUrl: process.env.EXPO_BASE_URL.replace(/\/$/, '') }
      : {}),
  },
});

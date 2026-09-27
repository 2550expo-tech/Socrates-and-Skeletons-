/**
 * Extends app.json at build time.
 *
 * The web build is served from https://2550expo-tech.github.io/Socrates-and-Skeletons-/
 * so it needs a base URL. That setting must NOT reach the phone app (it would
 * make the app look for its images and fonts under the wrong path), so it is
 * only applied when EXPO_WEB_BASE_URL is set, which the web workflow does.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};

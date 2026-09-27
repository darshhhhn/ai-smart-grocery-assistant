/* ============================================================================
 * config.js — Fallback configuration for the browser.
 *
 * When the app is launched through launch.bat, all model calls go through the
 * local Python backend and this key is never used. It only kicks in if someone
 * opens web/index.html directly from disk, with no backend running.
 * ==========================================================================*/
window.GA_CONFIG = {
  appName: 'AI Smart Grocery Assistant',
  version: '1.0.0',
  fallbackApiKey: '',
  defaultModel: 'openai/gpt-4o'
};

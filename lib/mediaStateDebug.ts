/**
 * Media State Validation Utility
 *
 * Use these functions in browser console to debug media state issues
 */

/**
 * Check if media state is synchronized
 * Run in browser console: validateMediaState()
 */
export function validateMediaState() {
  // Access React internal state (for debugging only)
  const rootElement = document.querySelector("[data-mediasoup-provider]");
  if (!rootElement) {
    console.error("❌ MediasoupProvider not found");
    return;
  }

  console.log("🔍 Media State Validation");
  console.log("=".repeat(50));

  // Check localStorage
  const storedPref = localStorage.getItem("meeting-join-preference");
  console.log("📦 localStorage preference:", storedPref);

  if (storedPref) {
    try {
      const parsed = JSON.parse(storedPref);
      console.log("   ✅ Valid JSON:", parsed);
    } catch (e) {
      console.error("   ❌ Invalid JSON in localStorage");
    }
  } else {
    console.warn("   ⚠️ No preference saved");
  }

  console.log("");
  console.log("💡 Tips:");
  console.log("   - Open React DevTools");
  console.log("   - Find MediasoupContext.Provider");
  console.log("   - Check value prop for current state");
  console.log("   - Compare isAudioMuted with button appearance");
  console.log("");
  console.log("🐛 Debug commands:");
  console.log("   localStorage.clear()           - Clear saved preferences");
  console.log("   validateMediaState()           - Run this check again");
}

/**
 * Clear all media preferences
 * Run in browser console: clearMediaPreferences()
 */
export function clearMediaPreferences() {
  localStorage.removeItem("meeting-join-preference");
  console.log("🗑️ Cleared meeting-join-preference");
  console.log("🔄 Please refresh the page to reset state");
}

/**
 * Set media preferences manually
 * Run in browser console: setMediaPreferences({ audio: false, video: false })
 */
export function setMediaPreferences(prefs: { audio: boolean; video: boolean }) {
  localStorage.setItem("meeting-join-preference", JSON.stringify(prefs));
  console.log("💾 Set preferences:", prefs);
  console.log("🔄 Please refresh the page to apply");
}

/**
 * Get current media preferences
 * Run in browser console: getMediaPreferences()
 */
export function getMediaPreferences() {
  const stored = localStorage.getItem("meeting-join-preference");
  if (stored) {
    const parsed = JSON.parse(stored);
    console.log("📋 Current preferences:", parsed);
    return parsed;
  } else {
    console.log("📋 No preferences saved (will use defaults)");
    return null;
  }
}

// Make functions available globally for console access
if (typeof window !== "undefined") {
  (window as any).validateMediaState = validateMediaState;
  (window as any).clearMediaPreferences = clearMediaPreferences;
  (window as any).setMediaPreferences = setMediaPreferences;
  (window as any).getMediaPreferences = getMediaPreferences;

  console.log("🛠️ Media debugging tools loaded:");
  console.log("   - validateMediaState()");
  console.log("   - clearMediaPreferences()");
  console.log("   - setMediaPreferences({ audio, video })");
  console.log("   - getMediaPreferences()");
}

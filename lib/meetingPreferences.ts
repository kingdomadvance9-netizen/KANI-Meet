/**
 * Meeting Join Preferences Utility
 *
 * Manages user preferences for joining meetings with audio/video on or off.
 * Used by MeetingSetup component to save preferences and MediasoupContext to read them.
 */

export interface JoinPreference {
  audio: boolean;
  video: boolean;
}

const STORAGE_KEY = "meeting-join-preference";

/**
 * Get user's saved join preference from localStorage
 * @returns JoinPreference object with audio and video flags
 */
export function getJoinPreference(): JoinPreference {
  if (typeof window === "undefined") {
    // Default for SSR
    return { audio: true, video: false };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        audio: parsed.audio ?? true,
        video: parsed.video ?? false,
      };
    }
  } catch (error) {
    console.error("Failed to parse join preference from localStorage:", error);
  }

  // Default preference: audio on, video off
  return { audio: true, video: false };
}

/**
 * Save user's join preference to localStorage
 * @param preference - JoinPreference object with audio and video flags
 */
export function saveJoinPreference(preference: JoinPreference): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    console.log("💾 Saved join preference:", preference);
  } catch (error) {
    console.error("Failed to save join preference to localStorage:", error);
  }
}

/**
 * Clear saved join preference from localStorage
 */
export function clearJoinPreference(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("🗑️ Cleared join preference");
  } catch (error) {
    console.error("Failed to clear join preference from localStorage:", error);
  }
}

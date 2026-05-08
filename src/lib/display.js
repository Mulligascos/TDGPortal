/**
 * Returns the display name for a profile.
 * Uses nickname if set, falls back to full_name.
 */
export function displayName(profile) {
  if (!profile) return "Unknown";
  return profile.nickname || profile.full_name || "Unknown";
}

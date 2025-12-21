/**
 * Format a duration in milliseconds to a human-readable string.
 * Automatically selects the appropriate unit based on magnitude.
 *
 * @param ms Duration in milliseconds
 * @returns Formatted string (e.g., "500ms", "2.50s", "1.25m", "2.00h")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else if (ms < 3600000) {
    return `${(ms / 60000).toFixed(2)}m`;
  } else {
    return `${(ms / 3600000).toFixed(2)}h`;
  }
}

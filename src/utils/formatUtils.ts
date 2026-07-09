/**
 * Format a duration in milliseconds to a human-readable string.
 * Automatically selects the appropriate unit based on magnitude.
 *
 * @param ms Duration in milliseconds
 * @returns Formatted string (e.g., "500ms", "2.50s", "1.25m", "2.00h")
 */
export function formatTimeRemaining(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a duration for the UI (stat tables, chart axis/tooltip labels).
 * Uses a compact decimal form for minutes/hours ("1.50m", "2.00h") which
 * reads well as a short label. NOTE: the server has its own formatDuration in
 * `server/utils/reportGenerator.ts` that intentionally uses a "1m 30s" form
 * better suited to prose in HTML reports — the two are deliberately different
 * presentations and are not shared.
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

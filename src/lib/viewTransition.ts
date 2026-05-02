/**
 * Thin wrapper around the View Transitions API.
 *
 * The browser snapshots the current DOM, runs `updateDom()` to mutate it,
 * snapshots the new DOM, and cross-fades between them. We use it for
 * route navigations so clicking a game tile (or a character tile) feels
 * like a crossfade instead of "old page unmount → blank frame → new page
 * mount."
 *
 * Feature detection + safe fallback:
 *   - If the browser lacks `document.startViewTransition` (Safari <18,
 *     Firefox <123, older Chromium), we run the update synchronously —
 *     the app still works, there's just no transition animation.
 *   - If the user prefers reduced motion, we also skip the transition
 *     so the app honours the accessibility setting.
 */
type UpdateCallback = () => void | Promise<void>;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function withViewTransition(update: UpdateCallback): void {
  // `document.startViewTransition` is typed as required in current TS
  // DOM libs, but it only exists in Chromium 111+, Firefox 123+, and
  // Safari 18+ — so we still feature-detect at runtime. The
  // `in document` guard narrows without needing a type assertion dance.
  if (
    !("startViewTransition" in document) ||
    typeof document.startViewTransition !== "function" ||
    prefersReducedMotion()
  ) {
    void update();
    return;
  }
  document.startViewTransition(update);
}

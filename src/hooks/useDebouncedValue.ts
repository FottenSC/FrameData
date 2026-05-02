import { useEffect, useState } from "react";

/**
 * Returns a value that only updates after `delayMs` has elapsed since the
 * most recent change to the source value. Changes that arrive inside the
 * delay window reset the timer.
 *
 * Used to throttle CPU-heavy derived state — e.g. the `displayedMoves`
 * memo in the frame-data table, which otherwise re-filters the entire
 * move list on every keystroke into the advanced-filter inputs.
 *
 * Note: keep the source value referentially stable when its contents
 * haven't actually changed. If a new array/object identity is produced on
 * every parent render, the debounce timer resets forever and the output
 * never catches up.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

import * as React from "react";
import { Input, InputProps } from "./input";

export interface DebouncedInputProps extends Omit<
  InputProps,
  "value" | "onChange"
> {
  /** Controlled value from parent. Changes here reset the internal draft. */
  value: string;
  /** Called after the user pauses typing for `delay` ms (default 150ms). */
  onDebouncedChange: (next: string) => void;
  /** Milliseconds of idle typing before the parent is notified. */
  delay?: number;
}

/**
 * Input that keeps its own draft state on every keystroke for immediate visual
 * feedback, but only notifies the parent after the user pauses typing.
 *
 * This is specifically to prevent filter inputs from kicking off a full
 * sort+filter pass over thousands of rows on every keypress. Local keystrokes
 * remain instant; the expensive downstream work runs once the typing settles.
 *
 * When the parent's `value` prop changes externally (e.g. Clear All / preset
 * applied), the internal draft is resynced.
 */
export const DebouncedInput = React.forwardRef<
  HTMLInputElement,
  DebouncedInputProps
>(({ value, onDebouncedChange, delay = 150, ...rest }, ref) => {
  const [draft, setDraft] = React.useState(value);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestOnChangeRef = React.useRef(onDebouncedChange);

  // Keep a ref so the setTimeout closure always calls the freshest handler.
  React.useEffect(() => {
    latestOnChangeRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  // Resync when the parent pushes a new value (e.g. Clear All).
  //
  // Critically, we also CANCEL any pending debounce timer here. Without
  // that, a "type then immediately Clear" sequence would race: the
  // user's keystroke timer fires after Clear has reset state, asserting
  // the typed value back into the parent and undoing the clear.
  React.useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDraft(value);
  }, [value]);

  // Flush any pending change on unmount so edits aren't lost.
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraft(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        latestOnChangeRef.current(next);
      }, delay);
    },
    [delay],
  );

  return <Input ref={ref} value={draft} onChange={handleChange} {...rest} />;
});
DebouncedInput.displayName = "DebouncedInput";

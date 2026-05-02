import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Warmup component for the Combobox / cmdk render path.
 *
 * The first time a user opens any FilterBuilder dropdown, several cold
 * costs come due in a single frame: cmdk mounts and compiles its filter
 * regex, Radix Popover creates its portal and runs Floating UI's first
 * positioning pass, React allocates fibers for the option list, etc.
 * Subsequent opens reuse all of that work.
 *
 * This component does that work silently during an idle window, then
 * unmounts itself. By the time the user clicks a real combobox, the
 * cold path has already run.
 *
 * IMPORTANT — state machine notes:
 *   - The effect MUST run only once (empty deps). A previous version
 *     keyed the effect on `phase`, which created a feedback loop:
 *     scheduling the close-timer and then bumping `phase` re-ran the
 *     effect, whose cleanup function then cancelled the very close
 *     timer it had just scheduled. The popover would mount and never
 *     unmount, leaving cmdk + an open Command subtree alive off-screen
 *     for the lifetime of the FilterBuilder. Every parent re-render
 *     (e.g. toggling the Advanced filters panel) then had to reconcile
 *     that hidden subtree, which is what caused the system-wide lag
 *     users reported.
 *   - Wrapped in React.memo to insulate from parent re-renders during
 *     the brief window where the warmup is still mounted.
 */
export const ComboboxWarmup = React.memo(function ComboboxWarmup() {
  const [phase, setPhase] = React.useState<"pending" | "open" | "done">(
    "pending",
  );

  React.useEffect(() => {
    let openHandle: number | undefined;
    let closeHandle: number | undefined;
    const w = window as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const usingRic = typeof w.requestIdleCallback === "function";

    const start = () => {
      setPhase("open");
      // 80ms is enough for cmdk + Radix Popover to complete their
      // first-render work; after that we transition straight to
      // "done", which causes this component to return null and
      // unmount its Popover subtree from the React tree entirely.
      closeHandle = window.setTimeout(() => setPhase("done"), 80);
    };

    if (usingRic) {
      openHandle = w.requestIdleCallback!(start, { timeout: 1500 });
    } else {
      // Fall back to a short setTimeout if requestIdleCallback isn't
      // available. The warmup is best-effort — running it slightly
      // later than ideal is fine.
      openHandle = window.setTimeout(start, 200);
    }

    return () => {
      if (openHandle != null) {
        if (usingRic && w.cancelIdleCallback) {
          w.cancelIdleCallback(openHandle);
        } else {
          window.clearTimeout(openHandle);
        }
      }
      if (closeHandle != null) {
        window.clearTimeout(closeHandle);
      }
    };
    // Empty deps on purpose — see comment in the JSDoc above. Adding
    // `phase` here would re-arm the effect every time we set it and
    // trigger a cleanup that cancels the in-flight close timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden
      // Pulled fully off-screen and locked at zero size so even if a
      // browser ever painted the contents during the brief open phase,
      // the user couldn't see or interact with it.
      style={{
        position: "fixed",
        left: -10000,
        top: -10000,
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <Popover open={phase === "open"} onOpenChange={() => {}}>
        <PopoverTrigger asChild>
          <button type="button" tabIndex={-1} aria-hidden>
            warmup
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <Command>
            <CommandInput placeholder="warmup" />
            <CommandList>
              <CommandEmpty>—</CommandEmpty>
              <CommandGroup>
                {/*
                  Render a couple of items so cmdk allocates its
                  per-item internals at least once. One item alone
                  doesn't exercise the full filter / score path.
                */}
                <CommandItem value="warmup-a">a</CommandItem>
                <CommandItem value="warmup-b">b</CommandItem>
                <CommandItem value="warmup-c">c</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
});

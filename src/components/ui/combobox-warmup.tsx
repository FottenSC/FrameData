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
 * The first time a user opens any FilterBuilder dropdown, three slow
 * cold-path costs come due in a single frame:
 *
 *   1. cmdk's `Command` tree mounts for the first time — registering the
 *      filter context, compiling its score regex, etc.
 *   2. Radix Popover creates its portal, runs Floating UI's first
 *      position computation, and installs its focus trap.
 *   3. React allocates fibers for ~150 `CommandItem`s in the largest
 *      lists (stances / properties), and the browser performs first
 *      layout on that subtree.
 *
 * Subsequent opens reuse the React fibers and warm browser layout
 * caches, so they feel snappy. The user only ever notices the FIRST
 * open feeling laggy.
 *
 * This component eliminates that perceptible lag by silently doing the
 * work during an idle window after the FilterBuilder mounts. We render
 * a real `<Popover>` + `<Command>` pair, programmatically open it
 * (off-screen and aria-hidden so it never appears to the user),
 * close it, and unmount once the cycle has run. The cmdk module's
 * internal regex caches and React's fiber tree are then primed; the
 * user's first real interaction skips all the cold-path costs.
 *
 * The warmup is gated on `requestIdleCallback` so it never competes
 * with the initial paint or any user input that's already in flight.
 */
export const ComboboxWarmup: React.FC = () => {
  const [phase, setPhase] = React.useState<"idle" | "open" | "done">("idle");

  React.useEffect(() => {
    if (phase !== "idle") return;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let openTimer: number | undefined;
    let closeTimer: number | undefined;
    let doneTimer: number | undefined;
    const ric = w.requestIdleCallback;
    const handle = ric
      ? ric(
          () => {
            // Open on next paint, close on the one after that, unmount
            // shortly after. Long enough for cmdk + Radix to finish
            // their first-render work, short enough that the warmup
            // wrapper releases its memory promptly.
            setPhase("open");
            closeTimer = window.setTimeout(() => {
              setPhase("idle");
              doneTimer = window.setTimeout(() => setPhase("done"), 100);
            }, 50);
          },
          { timeout: 1500 },
        )
      : window.setTimeout(() => setPhase("open"), 200);

    return () => {
      if (typeof handle === "number" && ric && w.cancelIdleCallback) {
        w.cancelIdleCallback(handle);
      } else if (typeof handle === "number") {
        window.clearTimeout(handle);
      }
      if (openTimer) window.clearTimeout(openTimer);
      if (closeTimer) window.clearTimeout(closeTimer);
      if (doneTimer) window.clearTimeout(doneTimer);
    };
  }, [phase]);

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
};

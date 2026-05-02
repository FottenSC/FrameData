import { toast } from "sonner";
import { ClipboardCheck, X } from "lucide-react";

/**
 * Show a "Copied!" toast.
 *
 * Uses Sonner's `toast.custom` so we own the entire markup — that lets us
 * render the copied notation as a real `<code>` chip, attach a clipboard
 * icon, and draw the countdown bar with full theme awareness instead of
 * piggy-backing on Sonner's stock success styling.
 *
 * The toast lifetime is controlled both by Sonner (`duration`) and by the
 * progress-bar animation, which reads `--toast-duration` from inline
 * style. The bar is implemented in `index.css` so the keyframes are
 * shared across all `.copied-toast` instances.
 */
export function showCopiedToast(copiedText: string, duration = 1800) {
  toast.custom(
    (id) => (
      <div
        className="copied-toast group relative pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-[420px] rounded-lg border border-border text-card-foreground shadow-lg p-3 pr-9 overflow-hidden"
        // Two inline-style jobs:
        //   1. Set `--toast-duration` so the `::after` progress rail
        //      animates over the same lifetime Sonner uses to dismiss.
        //   2. Set `background-color` explicitly. With Sonner's
        //      `unstyled: true` the wrapper has its own dark theme
        //      background-color of `transparent`, which can win the
        //      cascade against our `bg-card` Tailwind utility on this
        //      child div in some Tailwind v4 setups. Forcing it inline
        //      guarantees the card surface is visible.
        style={
          {
            ["--toast-duration" as string]: `${duration}ms`,
            backgroundColor: "var(--card)",
          } as React.CSSProperties
        }
      >
        {/*
          Status pill. Subtle emerald wash matches the "success" feel
          without competing with the copied text — the chip behind it
          is the actual content, not a stock green checkmark.
        */}
        <div className="flex-shrink-0 grid place-items-center w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25">
          <ClipboardCheck className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-tight">
            Copied to clipboard
          </div>
          <code className="block mt-1 text-[12px] font-mono text-muted-foreground truncate">
            {copiedText}
          </code>
        </div>

        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => toast.dismiss(id)}
          className="absolute top-1.5 right-1.5 grid place-items-center w-6 h-6 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ),
    {
      duration,
      // `unstyled` skips Sonner's default panel chrome so our card border
      // / shadow / radius don't double up with theirs.
      unstyled: true,
    },
  );
}

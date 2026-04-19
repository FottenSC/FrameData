import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyToastProps {
  /** What was copied; shown as a subtle second line. */
  copiedText: string;
  /** How long the toast will be visible, in ms. Drives the countdown bar. */
  duration: number;
}

/**
 * Body of the "Copied!" toast.
 *
 * Rendered via Sonner's `toast.custom()` so we get full control of the markup
 * instead of the default single-line message. Two lines (headline + copied
 * snippet), a check icon, and a countdown bar pinned to the bottom that
 * visibly ticks down over the toast's lifetime.
 */
const CopyToast: React.FC<CopyToastProps> = ({ copiedText, duration }) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden min-w-[240px] max-w-[360px]",
        "rounded-md border border-white/10 bg-zinc-900/95 backdrop-blur",
        "shadow-lg shadow-black/40",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shrink-0">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-50">
            <Copy className="h-3 w-3 text-zinc-400" />
            <span>Copied to clipboard</span>
          </div>
          {copiedText && (
            <div
              className="mt-0.5 truncate font-mono text-[12px] text-zinc-400"
              title={copiedText}
            >
              {copiedText}
            </div>
          )}
        </div>
      </div>

      {/*
        Countdown rail — a 2px track pinned to the bottom with a bar that
        scaleX-animates from 1 → 0 over `duration`ms. Using transform (not
        width) keeps it cheap.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/5"
        aria-hidden
      >
        <div
          className="h-full bg-emerald-400/80 animate-toast-progress"
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  );
};

/**
 * Show a "Copied!" toast with an emerald check badge, the copied snippet on
 * a second line, and a countdown bar that visibly ticks down to dismissal.
 */
export function showCopiedToast(copiedText: string, duration = 1800) {
  toast.custom(
    () => <CopyToast copiedText={copiedText} duration={duration} />,
    { duration, unstyled: true },
  );
}

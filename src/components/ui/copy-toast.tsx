import { toast } from "sonner";

/**
 * Show a "Copied!" toast.
 *
 * Uses Sonner's native styled toast (so it picks up the library's dark theme,
 * animations, and positioning) but decorates the wrapper with a CSS-driven
 * countdown bar via the `copied-toast` class + a custom property that carries
 * the remaining duration. See `index.css` for the `[data-sonner-toast].copied-toast::after`
 * rule that draws and animates the bar.
 *
 * Kept as a helper so the call site stays a one-liner:
 *
 *     showCopiedToast(textToCopy);
 */
export function showCopiedToast(copiedText: string, duration = 1800) {
  toast.success("Copied to clipboard", {
    description: copiedText,
    duration,
    // Make the duration visible to CSS so the ::after bar can animate over
    // exactly the lifetime of this specific toast.
    style: {
      ["--toast-duration" as any]: `${duration}ms`,
    },
    className: "copied-toast",
  });
}

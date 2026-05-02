"use client";

/**
 * Dialog wrapper — now backed by the native `<dialog>` element.
 *
 * Behavioural notes vs the previous Radix-backed implementation:
 *
 *   - `showModal()` puts the dialog in the browser's **top layer**, which
 *     naturally floats above everything else, locks scroll on the rest
 *     of the page, makes background content `inert`, and traps focus —
 *     all without a portal, overlay div, or focus-trap library.
 *   - The `::backdrop` pseudo-element styles the greyed-out scrim; see
 *     `src/index.css`.
 *   - Escape-to-close, initial focus, and return-focus are all handled
 *     by the user agent.
 *   - Backdrop click is NOT a native dismiss gesture, so we add one by
 *     listening for clicks whose target is the dialog element itself
 *     (clicks on descendants bubble up with target === descendant).
 *
 * API compatibility: consumers that imported
 * `{ Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
 *   DialogFooter, DialogTrigger, DialogClose, DialogOverlay, DialogPortal }`
 * from this module continue to work unchanged. `DialogOverlay` and
 * `DialogPortal` are now compat stubs — the backdrop is drawn by
 * `::backdrop` and the top-layer replaces the portal.
 */

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------- Context ----------
interface DialogCtxValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  dialogRef: React.MutableRefObject<HTMLDialogElement | null>;
  titleId: string;
  descriptionId: string;
}

const DialogContext = React.createContext<DialogCtxValue | null>(null);

function useDialogContext(component: string): DialogCtxValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Dialog>`);
  }
  return ctx;
}

// ---------- Root ----------
interface DialogProps {
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial state. */
  defaultOpen?: boolean;
  /** Notified every time the open state changes — including Escape /
   *  backdrop click / programmatic close. */
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const value = React.useMemo(
    () => ({ open: actualOpen, setOpen, dialogRef, titleId, descriptionId }),
    [actualOpen, setOpen, titleId, descriptionId],
  );

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
}

// ---------- Content ----------
type DialogContentProps = Omit<
  React.ComponentPropsWithoutRef<"dialog">,
  "open" | "onClose"
>;

function DialogContent({
  className,
  children,
  onClick,
  ...props
}: DialogContentProps) {
  const { open, setOpen, dialogRef, titleId, descriptionId } =
    useDialogContext("DialogContent");

  // Drive the native dialog's modal state from React state. We call
  // showModal/close rather than toggling the `open` attribute because
  // `open` attribute alone doesn't put the dialog in the top layer.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      try {
        el.showModal();
      } catch {
        // showModal throws if the element is already open with
        // open-attribute, or disconnected; fall back to a plain show().
        if (!el.open) el.show();
      }
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, dialogRef]);

  // The native 'close' event fires for Escape, form-method=dialog
  // submits, and explicit .close() calls. Mirror it back to React so
  // `onOpenChange` receives the dismissal.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => setOpen(false);
    el.addEventListener("close", handler);
    return () => el.removeEventListener("close", handler);
  }, [setOpen, dialogRef]);

  // Light-dismiss on backdrop click. A click whose target is the
  // dialog element itself (not a descendant) landed on the backdrop.
  const handleClick: React.MouseEventHandler<HTMLDialogElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.target === event.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-slot="dialog-content"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={handleClick}
      // Reset the user-agent stylesheet. Native <dialog> ships with a
      // default block layout and centred margin:auto; we want the
      // consuming className to win. `p-0` here is wiped by `p-6` from
      // the className string — callers pass their own padding.
      className={cn(
        "bg-background text-foreground fixed inset-0 m-auto w-full max-w-[calc(100%-2rem)] rounded-lg border p-6 shadow-lg grid gap-4 sm:max-w-lg",
        "max-h-[min(90vh,calc(100vh-2rem))] overflow-visible",
        "open:animate-in open:fade-in-0 open:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <XIcon />
        <span className="sr-only">Close</span>
      </button>
    </dialog>
  );
}

// ---------- Trigger / Close ----------
// Simple button wrappers; consumers can always roll their own by calling
// setOpen through whatever ref / context they prefer.
function DialogTrigger({
  onClick,
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  const { setOpen } = useDialogContext("DialogTrigger");
  return (
    <button
      type="button"
      data-slot="dialog-trigger"
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) setOpen(true);
      }}
    />
  );
}

function DialogClose({
  onClick,
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  const { setOpen } = useDialogContext("DialogClose");
  return (
    <button
      type="button"
      data-slot="dialog-close"
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) setOpen(false);
      }}
    />
  );
}

// ---------- Structural sub-parts ----------
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDialogContext("DialogTitle");
  return (
    <h2
      id={titleId}
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { descriptionId } = useDialogContext("DialogDescription");
  return (
    <p
      id={descriptionId}
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

// ---------- Compat stubs ----------
// Retained so any consumer that still imports these keeps compiling.
// They're no-ops under the native-dialog implementation:
//
//   - `DialogPortal`: native `<dialog>` uses the top layer instead of
//     a JS-managed portal, so there's nothing to portal. We render
//     children as-is.
//   - `DialogOverlay`: the scrim is `::backdrop` styled in CSS; this
//     component renders nothing so any stray instance collapses away.
//
function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DialogOverlay(_props: React.ComponentProps<"div">) {
  return null;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

import React from "react";
import { useCommand } from "@/contexts/CommandContext";

let commandPalettePromise:
  | Promise<typeof import("./CommandPalette")>
  | undefined;

export function preloadCommandPalette() {
  commandPalettePromise ??= import("./CommandPalette");
  return commandPalettePromise;
}

const LazyCommandPalette = React.lazy(() =>
  preloadCommandPalette().then((module) => ({
    default: module.CommandPalette,
  })),
);

export function CommandPaletteLoader() {
  const { open, setOpen } = useCommand();
  const [hasOpened, setHasOpened] = React.useState(open);

  React.useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  if (!hasOpened) return null;

  return (
    <React.Suspense fallback={null}>
      <LazyCommandPalette />
    </React.Suspense>
  );
}

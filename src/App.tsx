import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { router } from "./router";

function App() {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={500}>
      {/*
        `richColors` opts into Sonner's success/info/warning/error palettes so
        copied / saved / error toasts get the appropriate accent automatically.
        Per-toast extras (like the countdown bar on `showCopiedToast`) are
        applied via classNames + CSS custom properties in `index.css`.
      */}
      <Toaster position="top-left" theme="dark" richColors />
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}

export default App;

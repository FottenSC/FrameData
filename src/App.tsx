import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { router } from "./router";

function App() {
  return (
    <TooltipProvider>
      {/*
        Toaster is rendered unstyled — individual call sites produce their own
        JSX (see `showCopiedToast`) so every toast can carry its own visual
        language, icon and countdown.
      */}
      <Toaster position="top-left" theme="dark" />
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}

export default App;

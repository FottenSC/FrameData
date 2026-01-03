import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { router } from "./router";

function App() {
  return (
    <TooltipProvider>
      <Toaster
        position="top-left"
        theme="dark"
        toastOptions={{
          style: {
            background: "hsl(0, 0%, 20%)",
            border: "1px solid hsla(0, 0%, 100%, 0.1)",
            color: "hsl(0, 0%, 98%)",
          },
        }}
      />
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}

export default App;

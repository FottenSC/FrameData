import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    base: "./",
    plugins: [
        tailwindcss(),
        react({
            babel: {
                plugins: [
                    [
                        "babel-plugin-react-compiler",
                        {
                            /* Options (if any) */
                        },
                    ],
                ],
            },
        }),
    ],
    server: {
        port: 3000,
        open: true,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom", "react-router-dom"],
                    ui: [
                        "@radix-ui/react-dialog",
                        "@radix-ui/react-dropdown-menu",
                        "@radix-ui/react-popover",
                        "@radix-ui/react-select",
                        "@radix-ui/react-slot",
                        "lucide-react",
                        "cmdk",
                        "class-variance-authority",
                        "clsx",
                        "tailwind-merge",
                    ],
                    table: ["@tanstack/react-table", "@tanstack/react-virtual"],
                },
            },
        },
    },
    esbuild: {
        drop: process.env.NODE_ENV === "production" ? ["debugger"] : [],
    },
});

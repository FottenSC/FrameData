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
    },
    esbuild: {
        drop: process.env.NODE_ENV === "production" ? ["debugger"] : [],
    },
});

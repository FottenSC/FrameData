import path from "path";
import fs from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Custom plugin to inject game preload script
const gamePreloadPlugin = () => {
  return {
    name: "game-preload-injector",
    transformIndexHtml() {
      const gamesDir = path.resolve(__dirname, "public/Games");
      let games: string[] = [];
      try {
        if (fs.existsSync(gamesDir)) {
          games = fs.readdirSync(gamesDir).filter((file) => {
            return fs.statSync(path.join(gamesDir, file)).isDirectory();
          });
        }
      } catch (e) {
        console.warn("Could not read public/Games for preloading", e);
      }

      return [
        {
          tag: "script",
          children: `
            (function() {
              try {
                var path = window.location.pathname;
                var segments = path.split('/').filter(Boolean);
                if (segments.length > 0) {
                  var gameId = segments[0];
                  var knownGames = ${JSON.stringify(games)};
                  if (knownGames.indexOf(gameId) !== -1) {
                    var link = document.createElement('link');
                    link.rel = 'preload';
                    link.href = '/Games/' + gameId + '/Game.json';
                    link.as = 'fetch';
                    link.crossOrigin = 'anonymous';
                    document.head.appendChild(link);
                  }
                }
              } catch (e) {}
            })();
          `,
          injectTo: "head" as const,
        },
      ];
    },
  };
};

export default defineConfig({
  plugins: [
    gamePreloadPlugin(),
    tailwindcss(),
    react({
      babel: {
        plugins: [
          [
            "babel-plugin-react-compiler",
            {
              target: "19",
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
    // Vite's default is 500 KB; the frame-data table UI plus its vendor
    // deps (react, tanstack, radix, dnd-kit, cmdk, lucide) comfortably
    // exceed that without being a real problem. Bump the warning so the
    // build output stays readable.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /**
         * Split vendor code into stable, cache-friendly chunks. Each
         * group is picked so that bumping one dependency doesn't bust
         * unrelated chunks (good for repeat-visit HTTP cache hits) and
         * so no single chunk dominates initial download.
         *
         * App code continues to be bundled by Vite's default heuristics.
         */
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;

          // React and its inseparable internal deps (scheduler,
          // use-sync-external-store). Grouping them avoids a circular
          // "vendor -> react -> vendor" chunk edge.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("/use-sync-external-store/")
          ) {
            return "react";
          }
          if (id.includes("@tanstack/react-query")) {
            return "vendor-query";
          }
          if (id.includes("@tanstack/react-router")) {
            return "vendor-router";
          }
          if (
            id.includes("@tanstack/react-table") ||
            id.includes("@tanstack/react-virtual")
          ) {
            return "vendor-table";
          }
          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }
          if (id.includes("@dnd-kit")) {
            return "vendor-dnd";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("cmdk")) {
            return "vendor-cmdk";
          }
          if (id.includes("sonner")) {
            return "vendor-sonner";
          }
          if (id.includes("fflate")) {
            return "vendor-fflate";
          }
          // Small utility libs — keep them together to avoid a long tail
          // of 1-2 KB chunks.
          if (
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("class-variance-authority")
          ) {
            return "vendor-utils";
          }
          // Fall through to Vite's default chunking for uncategorized
          // deps. Returning a catchall string here risks a circular
          // "vendor -> react -> vendor" chunk if one of those deps
          // transitively depends on react.
          return undefined;
        },
      },
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["debugger", "console"] : [],
  },
});

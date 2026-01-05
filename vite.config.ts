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
    rollupOptions: {
      output: {
        // Let Vite handle chunk splitting automatically
      },
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["debugger", "console"] : [],
  },
});

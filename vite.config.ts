import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import eslintPlugin from "vite-plugin-eslint";
import svgr from "vite-plugin-svgr";

const host = process.env.TAURI_DEV_HOST;

const ReactCompilerConfig = {
  // Skip components with errors instead of failing the build
  panicThreshold: "none",
  logger: {
    logEvent(filename, event) {
      switch (event.kind) {
        case "CompileSuccess": {
          console.log(`✅ Compiled: ${filename}`);
          break;
        }
        case "CompileError": {
          console.log(`❌ Skipped: ${filename}`);
          console.error(`❌ Compilation failed: ${filename}`);
          console.error(
            `Full detail: ${JSON.stringify(event.detail, null, 2)}`,
          );
          console.error(`Reason: ${event.detail.reason}`);

          if (event.detail.description) {
            console.error(`Details: ${event.detail.description}`);
          }

          if (event.detail.loc) {
            const { line, column } = event.detail.loc.start;
            console.error(`Location: Line ${line}, Column ${column}`);
          }

          if (event.detail.suggestions) {
            console.error("Suggestions:", event.detail.suggestions);
          }

          break;
        }
        default: {
          /* empty */
        }
      }
    },
  },
};

// https://vite.dev/config/
export default defineConfig({
  base: "/LightningPlayer/",
  plugins: [
    react({
      babel: {
        plugins: [
          "@emotion",
          ["babel-plugin-react-compiler", ReactCompilerConfig],
        ],
      },
    }),
    eslintPlugin({
      cache: false,
      include: ["./src/**/*.js", "./src/**/*.jsx"],
      exclude: [],
    }),
    svgr(),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 3420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 3421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    chunkSizeWarningLimit: 600,
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target:
      process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});

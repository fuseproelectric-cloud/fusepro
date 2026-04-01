import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "client",
    include: ["tests/frontend/**/*.test.tsx", "tests/frontend/**/*.test.ts"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/frontend/setup.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});

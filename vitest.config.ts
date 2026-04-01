import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "server",
    include: ["tests/api/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
    globals: true,
    forceExit: true,
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});

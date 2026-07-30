import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Default to Node; only DOM-dependent suites opt in via a
    // `// @vitest-environment jsdom` docblock, so parser tests stay fast.
    environment: "node",
  },
});

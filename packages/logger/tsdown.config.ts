import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  external: ["express", "@types/express", "@types/express-serve-static-core"],
  exports: { legacy: true },
});

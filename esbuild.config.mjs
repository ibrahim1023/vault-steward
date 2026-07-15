import esbuild from "esbuild";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  platform: "node",
  target: "es2020",
  outfile: "main.js",
  sourcemap: process.argv.includes("--watch") ? "inline" : false,
  minify: false
});

await copyFile(resolve("node_modules/sql.js/dist/sql-wasm.wasm"), resolve("sql-wasm.wasm"));

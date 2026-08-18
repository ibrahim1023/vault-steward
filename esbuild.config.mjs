import esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sqliteWasmBase64 = await readFile(
  resolve("node_modules/sql.js/dist/sql-wasm-browser.wasm"),
  "base64"
);

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  platform: "node",
  conditions: ["browser"],
  target: "es2020",
  outfile: "main.js",
  define: { __SQLITE_WASM_BASE64__: JSON.stringify(sqliteWasmBase64) },
  sourcemap: process.argv.includes("--watch") ? "inline" : false,
  minify: false
});

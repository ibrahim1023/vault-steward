import esbuild from "esbuild";

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

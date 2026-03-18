import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

const rewriteImportMetaPlugin = {
  name: "rewrite-import-meta-url",
  setup(build) {
    build.onLoad({ filter: /src\\.*\.js$/ }, async (args) => {
      const source = await fs.readFile(args.path, "utf8");
      return {
        contents: source.replaceAll("import.meta.url", "__SITENAVIGATOR_IMPORT_META_URL__"),
        loader: "js",
      };
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(serverRoot, "src", "server.js")],
  outfile: path.join(serverRoot, "build", "server.cjs"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcemap: false,
  legalComments: "none",
  banner: {
    js: 'const __SITENAVIGATOR_IMPORT_META_URL__ = require("url").pathToFileURL(__filename).href;',
  },
  plugins: [rewriteImportMetaPlugin],
});

console.log("Bundled server/build/server.cjs for portable packaging");
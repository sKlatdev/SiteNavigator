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

const stripExpressViewAutoloadPlugin = {
  name: "strip-express-view-autoload",
  setup(build) {
    build.onLoad({ filter: /[\\/]express[\\/]lib[\\/]view\.js$/ }, async (args) => {
      const source = await fs.readFile(args.path, "utf8");
      const patched = source.replace(
        /\n\s*\/\/ default engine export[\s\S]*?\n\s*opts\.engines\[this\.ext\] = fn\n/,
        "\n    throw new Error('Automatic Express view-engine loading is disabled in the portable build. Register an engine explicitly before rendering.')\n"
      );

      if (patched === source) {
        throw new Error("Failed to strip Express view autoload block from express/lib/view.js");
      }

      return {
        contents: patched,
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
  plugins: [rewriteImportMetaPlugin, stripExpressViewAutoloadPlugin],
});

console.log("Bundled server/build/server.cjs for portable packaging");
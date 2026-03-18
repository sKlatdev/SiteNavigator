import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..");
const clientDistDir = path.join(repoRoot, "client", "dist");
const serverPublicDir = path.join(serverRoot, "public");

if (!fs.existsSync(clientDistDir)) {
  throw new Error(`Client build output not found at ${clientDistDir}. Run the client build first.`);
}

fs.rmSync(serverPublicDir, { recursive: true, force: true });
fs.mkdirSync(serverPublicDir, { recursive: true });
fs.cpSync(clientDistDir, serverPublicDir, { recursive: true });

console.log(`Prepared server/public from ${clientDistDir}`);
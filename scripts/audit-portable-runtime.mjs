import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const targets = [
  { name: "server", relPath: "server" },
  { name: "client", relPath: "client" },
];

function runNpmLsJson(prefixPath) {
  const command = `npm ls --omit=dev --json --long --prefix "${prefixPath}"`;
  const raw = execSync(command, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

function collectNodes(tree, list = []) {
  if (!tree || typeof tree !== "object") return list;

  const deps = tree.dependencies || {};
  for (const [name, dep] of Object.entries(deps)) {
    if (!dep || dep.missing) continue;
    const entry = {
      name,
      version: dep.version || "unknown",
      path: dep.path || "",
    };
    list.push(entry);
    collectNodes(dep, list);
  }

  return list;
}

function uniqueByNameAndVersion(nodes) {
  const seen = new Set();
  const out = [];
  for (const node of nodes) {
    const key = `${node.name}@${node.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(node);
  }
  return out;
}

function readPackageManifest(packagePath) {
  const manifestPath = path.join(packagePath, "package.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw);
}

function analyzeManifest(name, version, manifest) {
  const issues = [];

  const scripts = manifest?.scripts || {};
  for (const scriptName of ["preinstall", "install", "postinstall"]) {
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      issues.push(`has ${scriptName} script`);
    }
  }

  if (manifest?.gypfile) {
    issues.push("declares gypfile=true");
  }

  if (manifest?.binary) {
    issues.push("declares binary metadata");
  }

  if (manifest?.os || manifest?.cpu) {
    issues.push("declares OS/CPU constraints");
  }

  return {
    packageId: `${name}@${version}`,
    issues,
  };
}

function auditTarget(target) {
  const targetPath = path.join(repoRoot, target.relPath);
  const tree = runNpmLsJson(targetPath);
  const runtimeNodes = uniqueByNameAndVersion(collectNodes(tree));

  const findings = [];
  for (const node of runtimeNodes) {
    if (!node.path) continue;
    const manifest = readPackageManifest(node.path);
    if (!manifest) continue;

    const analysis = analyzeManifest(node.name, node.version, manifest);
    if (analysis.issues.length > 0) {
      findings.push(analysis);
    }
  }

  return {
    target: target.name,
    runtimeNodes,
    findings,
  };
}

function printAudit(result) {
  console.log(`\n[${result.target}] production dependency count: ${result.runtimeNodes.length}`);
  for (const node of result.runtimeNodes) {
    console.log(`- ${node.name}@${node.version}`);
  }

  if (result.findings.length === 0) {
    console.log(`[${result.target}] no portable-runtime risk markers found.`);
    return;
  }

  console.log(`[${result.target}] potential portable-runtime risk markers:`);
  for (const finding of result.findings) {
    console.log(`- ${finding.packageId}: ${finding.issues.join(", ")}`);
  }
}

let hasFindings = false;
for (const target of targets) {
  const result = auditTarget(target);
  printAudit(result);
  if (result.findings.length > 0) {
    hasFindings = true;
  }
}

if (hasFindings) {
  console.error("\nPortable dependency audit found risk markers. Review findings before release.");
  process.exit(1);
}

console.log("\nPortable dependency audit passed.");

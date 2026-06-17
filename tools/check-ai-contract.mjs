import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AI_VERIFY_CONTRACT } from "../src/ai-verify.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const checks = [];

function record(id, pass, details = "") {
  checks.push({ id, pass: !!pass, details });
}

function includesAll(text, values) {
  return values.filter((value) => !text.includes(value));
}

const [html, liveSim, aiVerify, readme, aiDocs] = await Promise.all([
  readFile(path.join(root, "live.html"), "utf8"),
  readFile(path.join(root, "src", "live-sim.mjs"), "utf8"),
  readFile(path.join(root, "src", "ai-verify.mjs"), "utf8"),
  readFile(path.join(root, "README.md"), "utf8"),
  readFile(path.join(root, "docs", "ai-verification.md"), "utf8"),
]);

record("entry.live_html.present", html.includes('data-testid="app-root"'), "live.html has app root test id.");
record("entry.index_html.removed", !(await fileExists(path.join(root, "index.html"))), "index.html is not an app entry.");
record("entry.module_script", html.includes('type="module"') && html.includes("src/live-sim.mjs"), "live.html loads the module entry.");
record("entry.state_json_node", html.includes(`id="${AI_VERIFY_CONTRACT.stateScriptId}"`) && html.includes('type="application/json"'), "JSON snapshot node exists.");

const missingRequired = includesAll(
  html,
  AI_VERIFY_CONTRACT.requiredTestIds.map((id) => `data-testid="${id}"`),
);
record("testids.required.in_html", missingRequired.length === 0, missingRequired.length ? `Missing ${missingRequired.join(", ")}` : "All required test ids are in live.html.");

record("verify.contract.exported", aiVerify.includes("export const AI_VERIFY_CONTRACT"), "Verification contract is exported.");
record("verify.global.installed", aiVerify.includes(AI_VERIFY_CONTRACT.globalName), "Browser global name is defined.");
record("verify.contract_global", aiVerify.includes("getContract"), "Browser global exposes getContract().");
record("verify.seed_support", aiVerify.includes("ai_seed") && aiVerify.includes("Math.random = seeded"), "Deterministic seed support is wired.");
record("verify.assertions", aiVerify.includes("getAssertions") && aiVerify.includes("getAssertSummary"), "Built-in assertions are exposed.");
record("verify.json_sync", aiVerify.includes("textContent = JSON.stringify(snapshot)"), "Snapshot is written to JSON node.");

for (const fn of ["installAiDeterminism", "initAiVerification", "syncAiVerification"]) {
  record(`live.${fn}.used`, liveSim.includes(fn), `${fn} is used by live-sim.mjs.`);
}

const generatedSignals = [
  'data-testid", "feed-row"',
  '`scheme-${kind}-${key}`',
  '"player-court"',
  '"player-bench"',
  "${p.id}",
];
const missingGenerated = includesAll(liveSim, generatedSignals);
record("testids.generated.in_runtime", missingGenerated.length === 0, missingGenerated.length ? `Missing ${missingGenerated.join(", ")}` : "Runtime-generated rows and controls have stable ids.");

record("docs.readme.ai_url", readme.includes("ai_verify=1&seed=demo-001"), "README documents the deterministic verification URL.");
record("docs.ai_contract", aiDocs.includes("window.__NBA_LIVE_VERIFY__") && aiDocs.includes("getAssertSummary"), "AI verification docs describe the browser contract.");

if (args.has("url")) {
  const url = args.get("url");
  try {
    const response = await fetch(url);
    const text = await response.text();
    record("server.url.ok", response.ok, `${url} returned ${response.status}.`);
    record("server.url.entry", text.includes("src/live-sim.mjs"), "Served page contains module entry.");
  } catch (error) {
    record("server.url.ok", false, error instanceof Error ? error.message : String(error));
  }
}

const failed = checks.filter((check) => !check.pass);
const report = {
  protocol: AI_VERIFY_CONTRACT.protocol,
  version: AI_VERIFY_CONTRACT.version,
  pass: failed.length === 0,
  total: checks.length,
  failed: failed.map((check) => check.id),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;

async function fileExists(file) {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

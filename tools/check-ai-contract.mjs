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

const [html, liveSim, aiVerify, tactical, tacticalData, readme, aiDocs] = await Promise.all([
  readFile(path.join(root, "live.html"), "utf8"),
  readFile(path.join(root, "src", "live-sim.mjs"), "utf8"),
  readFile(path.join(root, "src", "ai-verify.mjs"), "utf8"),
  readFile(path.join(root, "src", "tactical.mjs"), "utf8"),
  readFile(path.join(root, "src", "data", "tactical-data.mjs"), "utf8"),
  readFile(path.join(root, "README.md"), "utf8"),
  readFile(path.join(root, "docs", "ai-verification.md"), "utf8"),
]);

record("entry.live_html.present", html.includes('data-testid="app-root"'), "live.html has app root test id.");
record("entry.index_html.removed", !(await fileExists(path.join(root, "index.html"))), "index.html is not an app entry.");
record("entry.module_script", html.includes('type="module"') && html.includes("src/live-sim.mjs"), "live.html loads the module entry.");
record("entry.state_json_node", html.includes(`id="${AI_VERIFY_CONTRACT.stateScriptId}"`) && html.includes('type="application/json"'), "JSON snapshot node exists.");
record("entry.no_command_tab", !html.includes('data-testid="tab-command"'), "Command is not exposed as a persistent tab in live.html.");

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
record("verify.command_phase_assertions", aiVerify.includes("live.no_command_tab") && aiVerify.includes("command.visible_only_during_window") && aiVerify.includes("command.phase_matches_window"), "Command phase assertions are wired.");
record("verify.command_ui_snapshot", aiVerify.includes("commandUi:") && aiVerify.includes("command.compact_by_default") && aiVerify.includes("command.final_plan.present") && aiVerify.includes("command.recommendations_hidden_without_help") && aiVerify.includes("firstScreenFits") && aiVerify.includes("commandLineupSignals"), "Compact command UI snapshot and assertions are wired.");
record("verify.command_staff_snapshot", aiVerify.includes("commandStaff:") && aiVerify.includes("commandStaffSignals") && aiVerify.includes("staff.visible_reads.each_has_cost"), "Coach staff problem/read/cost snapshot and assertions are wired.");
record("verify.command_commit_snapshot", aiVerify.includes("commandCommitSignals") && aiVerify.includes("command.commit_summary.single") && aiVerify.includes("command.commit_summary.no_draft_spam") && aiVerify.includes("command.commit.accepted_cost.present") && aiVerify.includes("command.feedback.references_accepted_cost"), "Command commit summary, accepted cost, feedback, and no-spam assertions are wired.");
record("verify.tactic_lesson_snapshot", aiVerify.includes("tacticLessons:") && aiVerify.includes("tacticLessonSignals") && aiVerify.includes("lesson.frame_count_minimum") && tacticalData.includes("TACTIC_LESSONS"), "Tactic lesson snapshot, assertions, and data are wired.");
record("verify.postgame_recap_snapshot", aiVerify.includes("postgameRecapSignals") && aiVerify.includes("postgame.recap.traceable_when_present") && liveSim.includes("renderPostCoachRecap"), "Postgame coach recap snapshot and assertions are wired.");
record("verify.json_sync", aiVerify.includes("textContent = JSON.stringify(snapshot)"), "Snapshot is written to JSON node.");
record("verify.tactical_snapshot", aiVerify.includes("compactTacticalState") && aiVerify.includes("tactical,"), "Snapshot includes compact tactical state.");

for (const fn of ["installAiDeterminism", "initAiVerification", "syncAiVerification"]) {
  record(`live.${fn}.used`, liveSim.includes(fn), `${fn} is used by live-sim.mjs.`);
}

for (const fn of ["createPossessionContext", "finalizePossessionContext", "registerLivecastTrace", "renderCoachReadModel"]) {
  record(`tactical.${fn}.used`, liveSim.includes(fn), `${fn} is wired into live-sim.mjs.`);
}

record("tactical.module.present", tactical.includes("export function createPossessionContext") && tactical.includes("export function compactTacticalState"), "Tactical module exports context and compact snapshot helpers.");
record("tactical.data.present", tacticalData.includes("TACTICAL_TRAITS") && tacticalData.includes("SCHEME_REQUIREMENTS"), "Tactical data has player traits and scheme requirements.");

const generatedSignals = [
  'data-testid", "feed-row"',
  "dataset.aiLivecastId",
  "dataset.aiContextId",
  "dataset.aiCauseIds",
  "dataset.aiCommandSessionId",
  "dataset.aiAdoptedAdviceId",
  "dataset.aiAcceptedCost",
  "dataset.aiLessonId",
  "dataset.aiFeedbackKind",
  '`scheme-${kind}-${key}`',
  '`lesson-open-${lesson.lessonId}`',
  '"post-recap-item"',
  '"post-recap-lesson"',
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
    await checkServerAssets(url, text);
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

async function checkServerAssets(pageUrl, servedHtml) {
  const assets = extractServerAssets(pageUrl, servedHtml);
  record("server.assets.discovered", assets.length > 0, assets.length ? `Discovered ${assets.length} CSS/module assets.` : "No CSS/module assets were found in served HTML.");

  for (const asset of assets) {
    const id = `server.asset.${asset.id}`;

    try {
      const response = await fetch(asset.url);
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const head = text.slice(0, 200);
      const isHtml = /^\s*<!doctype html/i.test(head) || /<html[\s>]/i.test(head);
      const mimeOk = asset.kind === "stylesheet"
        ? /(^|;|\s)text\/css\b/i.test(contentType)
        : /(^|;|\s)(text|application)\/(javascript|ecmascript)\b/i.test(contentType);

      record(`${id}.ok`, response.ok, `${asset.path} returned ${response.status}.`);
      record(`${id}.mime`, mimeOk, `${asset.path} content-type is ${contentType || "missing"}.`);
      record(`${id}.not_html`, !isHtml, isHtml ? `${asset.path} returned HTML fallback content.` : `${asset.path} did not return HTML fallback content.`);
    } catch (error) {
      record(`${id}.ok`, false, error instanceof Error ? error.message : String(error));
    }
  }
}

function extractServerAssets(pageUrl, servedHtml) {
  const assets = [];

  for (const match of servedHtml.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = getAttribute(tag, "rel");
    const href = getAttribute(tag, "href");
    if (href && rel?.toLowerCase().split(/\s+/).includes("stylesheet")) {
      assets.push(createAsset(pageUrl, href, "stylesheet"));
    }
  }

  for (const match of servedHtml.matchAll(/<script\b[^>]*>/gi)) {
    const tag = match[0];
    const type = getAttribute(tag, "type");
    const src = getAttribute(tag, "src");
    if (src && type?.toLowerCase() === "module") {
      assets.push(createAsset(pageUrl, src, "module"));
    }
  }

  return assets;
}

function createAsset(pageUrl, assetPath, kind) {
  const url = new URL(assetPath, pageUrl);
  const id = url.pathname.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return { id, kind, path: assetPath, url };
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

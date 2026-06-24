import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AI_VERIFY_CONTRACT } from "../src/ai-verify.mjs";
import { TACTIC_LESSONS } from "../src/data/tactical-data.mjs";

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

const [html, liveSim, tacticBoard, commandCenter, livecast, postgameRecap, aiVerify, commandSignals, tacticLessonSignalsSource, postgameSignalsSource, aiDomUtils, tactical, tacticalData, playerSmoke, readme, aiDocs, architectureDocs, structurePlanDocs] = await Promise.all([
  readFile(path.join(root, "live.html"), "utf8"),
  readFile(path.join(root, "src", "live-sim.mjs"), "utf8"),
  readFile(path.join(root, "src", "features", "tactic-board.mjs"), "utf8"),
  readFile(path.join(root, "src", "features", "command-center.mjs"), "utf8"),
  readFile(path.join(root, "src", "features", "livecast.mjs"), "utf8"),
  readFile(path.join(root, "src", "features", "postgame-recap.mjs"), "utf8"),
  readFile(path.join(root, "src", "ai-verify.mjs"), "utf8"),
  readFile(path.join(root, "src", "ai", "command-signals.mjs"), "utf8"),
  readFile(path.join(root, "src", "ai", "tactic-lesson-signals.mjs"), "utf8"),
  readFile(path.join(root, "src", "ai", "postgame-signals.mjs"), "utf8"),
  readFile(path.join(root, "src", "ai", "dom-utils.mjs"), "utf8"),
  readFile(path.join(root, "src", "tactical.mjs"), "utf8"),
  readFile(path.join(root, "src", "data", "tactical-data.mjs"), "utf8"),
  readFile(path.join(root, "tools", "player-smoke.mjs"), "utf8"),
  readFile(path.join(root, "README.md"), "utf8"),
  readFile(path.join(root, "docs", "ai-verification.md"), "utf8"),
  readFile(path.join(root, "docs", "architecture.md"), "utf8"),
  readFile(path.join(root, "docs", "ai-readable-structure-refactor-plan.md"), "utf8"),
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
record("verify.command_ui_snapshot", aiVerify.includes("commandUi:") && aiVerify.includes("command.compact_by_default") && aiVerify.includes("command.final_plan.present") && aiVerify.includes("command.recommendations_hidden_without_help") && commandSignals.includes("firstScreenFits") && commandSignals.includes("commandLineupSignals") && commandSignals.includes("commandRecommendationSignals"), "Compact command UI snapshot and assertions are wired.");
record("verify.command_staff_snapshot", aiVerify.includes("commandStaff:") && commandSignals.includes("commandStaffSignals") && aiVerify.includes("staff.visible_reads.each_has_cost"), "Coach staff problem/read/cost snapshot and assertions are wired.");
record("verify.command_commit_snapshot", commandSignals.includes("commandCommitSignals") && aiVerify.includes("command.commit_summary.single") && aiVerify.includes("command.commit_summary.no_draft_spam") && aiVerify.includes("command.commit.accepted_cost.present") && aiVerify.includes("command.feedback.references_accepted_cost"), "Command commit summary, accepted cost, feedback, and no-spam assertions are wired.");
record("verify.tactic_lesson_snapshot", aiVerify.includes("tacticLessons:") && tacticLessonSignalsSource.includes("tacticLessonSignals") && aiVerify.includes("lesson.timeline.five_v_five_system") && aiVerify.includes("lesson.timeline.action_grammar") && aiVerify.includes("lesson.timeline.beat_causality") && aiVerify.includes("lesson.timeline.side_counts") && aiVerify.includes("lesson.timeline.moving_actors") && aiVerify.includes("lesson.timeline.motion_distance") && aiVerify.includes("lesson.modal.renders_timeline") && tacticLessonSignalsSource.includes("sampleTacticLessonMotion") && tacticBoard.includes("data-ai-actor-id") && tacticBoard.includes("data-ai-primary") && tacticBoard.includes("data-ai-action-id") && tacticalData.includes("five-v-five-action-motion-v2") && tacticalData.includes("primaryPersonnel: 5"), "Tactic lesson snapshot, 5v5 action timeline assertions, motion sampler, and rendered board coordinates are wired.");
checkFiveVsFiveTacticLessons();
record("structure.tactic_board_feature_module", liveSim.includes("./features/tactic-board.mjs") && tacticBoard.includes("export function initTacticBoardFeature") && tacticBoard.includes("export function openTacticLesson") && tacticBoard.includes("export function lessonIdForAdvice") && !liveSim.includes("function renderTacticBoard("), "Tactic board learning layer is extracted from live-sim into a feature module.");
record("structure.command_center_feature_module", liveSim.includes("./features/command-center.mjs") && commandCenter.includes("export function initCommandCenterFeature") && commandCenter.includes("export function createCommandSession") && commandCenter.includes("export function commitSubWindowSchemePlan") && commandCenter.includes("export function renderCommandStaff") && commandCenter.includes("export function commandEffectFeedbackText") && !liveSim.includes("function createCommandSession(") && !liveSim.includes("function commitSubWindowSchemePlan(") && !liveSim.includes("function commandEffectFeedbackText("), "Command session, staff reads, final plan commit, and command feedback logic are extracted from live-sim into a feature module.");
record("structure.livecast_feature_module", liveSim.includes("./features/livecast.mjs") && livecast.includes("export function pushFeed") && livecast.includes("export function richFeed") && livecast.includes("export function homeCrowdText") && livecast.includes("export function fmtClock") && livecast.includes("registerLivecastTrace") && livecast.includes("dataset.aiLivecastId") && !liveSim.includes("function pushFeed(") && !liveSim.includes("function richFeed(") && !liveSim.includes("registerLivecastTrace"), "Livecast row rendering, trace DOM attributes, rich feed, home-crowd text, and clock formatting are extracted from live-sim into a feature module.");
record("structure.postgame_recap_feature_module", liveSim.includes("./features/postgame-recap.mjs") && postgameRecap.includes("export function buildPostgameRecapItems") && postgameRecap.includes("export function renderPostCoachRecap") && postgameRecap.includes("data-ai-command-session-id") && postgameRecap.includes("openTacticLesson") && !liveSim.includes("function buildPostgameRecapItems(") && !liveSim.includes("function renderPostCoachRecap("), "Postgame command recap items, trace DOM attributes, and lesson links are extracted from live-sim into a feature module.");
record("structure.ai_snapshot_helper_modules", aiVerify.includes("./ai/command-signals.mjs") && aiVerify.includes("./ai/tactic-lesson-signals.mjs") && aiVerify.includes("./ai/postgame-signals.mjs") && commandSignals.includes("export function commandPanelMetrics") && commandSignals.includes("export function commandCommitSignals") && tacticLessonSignalsSource.includes("export function tacticLessonSignals") && tacticLessonSignalsSource.includes("export function sampleTacticLessonMotion") && postgameSignalsSource.includes("export function postgameRecapSignals") && aiDomUtils.includes("export function isVisible") && aiDomUtils.includes("export function parsePercent"), "AI verification internals are split into feature-scoped helper modules while ai-verify remains the public entry.");
record("tools.player_smoke.present", playerSmoke.includes("player-smoke") && playerSmoke.includes("getAssertSummary") && playerSmoke.includes("sampleTacticLessonMotion") && playerSmoke.includes("screenshot(page") && playerSmoke.includes("snapshots/player-smoke"), "Player-path browser smoke can generate screenshots and JSON evidence.");
record("verify.postgame_recap_snapshot", postgameSignalsSource.includes("postgameRecapSignals") && aiVerify.includes("postgame.recap.traceable_when_present") && liveSim.includes("renderPostCoachRecap"), "Postgame coach recap snapshot and assertions are wired.");
record("verify.json_sync", aiVerify.includes("textContent = JSON.stringify(snapshot)"), "Snapshot is written to JSON node.");
record("verify.tactical_snapshot", aiVerify.includes("compactTacticalState") && aiVerify.includes("tactical,"), "Snapshot includes compact tactical state.");

for (const fn of ["installAiDeterminism", "initAiVerification", "syncAiVerification"]) {
  record(`live.${fn}.used`, liveSim.includes(fn), `${fn} is used by live-sim.mjs.`);
}

for (const fn of ["createPossessionContext", "finalizePossessionContext", "renderCoachReadModel"]) {
  record(`tactical.${fn}.used`, liveSim.includes(fn), `${fn} is wired into live-sim.mjs.`);
}
record("tactical.registerLivecastTrace.used", livecast.includes("registerLivecastTrace"), "registerLivecastTrace is wired into the livecast feature module.");

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
const runtimeGeneratedSurface = `${liveSim}\n${livecast}\n${postgameRecap}`;
const missingGenerated = includesAll(runtimeGeneratedSurface, generatedSignals);
record("testids.generated.in_runtime", missingGenerated.length === 0, missingGenerated.length ? `Missing ${missingGenerated.join(", ")}` : "Runtime-generated rows and controls have stable ids.");

record("docs.readme.ai_url", readme.includes("ai_verify=1&seed=demo-001"), "README documents the deterministic verification URL.");
record("docs.ai_contract", aiDocs.includes("window.__NBA_LIVE_VERIFY__") && aiDocs.includes("getAssertSummary"), "AI verification docs describe the browser contract.");
record("docs.structure_plan", architectureDocs.includes("src/features/tactic-board.mjs") && architectureDocs.includes("src/features/command-center.mjs") && architectureDocs.includes("src/features/livecast.mjs") && architectureDocs.includes("src/features/postgame-recap.mjs") && architectureDocs.includes("src/ai/command-signals.mjs") && structurePlanDocs.includes("Phase 1") && structurePlanDocs.includes("Phase 2") && structurePlanDocs.includes("Phase 3") && structurePlanDocs.includes("Phase 4") && structurePlanDocs.includes("Phase 5") && structurePlanDocs.includes("src/features/tactic-board.mjs") && structurePlanDocs.includes("src/features/command-center.mjs") && structurePlanDocs.includes("src/features/livecast.mjs") && structurePlanDocs.includes("src/features/postgame-recap.mjs") && structurePlanDocs.includes("src/ai/tactic-lesson-signals.mjs"), "Architecture docs and structure refactor plan describe the extracted feature and AI snapshot helper modules.");

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

function checkFiveVsFiveTacticLessons() {
  const lessons = Object.values(TACTIC_LESSONS);
  const reports = lessons.map((lesson) => analyzeFiveVsFiveLesson(lesson));

  record(
    "lesson.data.pure_animation_contract",
    reports.every((report) => report.system === "five-v-five-action-motion-v2" && report.mode === "pure-animation" && report.pureAnimation && report.loop),
    reports.map((report) => `${report.lessonId}:${report.system}/${report.mode}/pure=${report.pureAnimation}/loop=${report.loop}`).join(","),
  );
  record(
    "lesson.data.five_v_five_actor_tracks",
    reports.every((report) => report.actorCount === 10 && report.personnel === 10 && report.primaryPersonnel === 5 && report.trackCount === 10 && report.sideCounts.offense === 5 && report.sideCounts.defense === 5 && report.missingTracks.length === 0 && report.extraTracks.length === 0),
    reports.map((report) => `${report.lessonId}:actors=${report.actorCount}/personnel=${report.personnel}/primary=${report.primaryPersonnel}/off=${report.sideCounts.offense}/def=${report.sideCounts.defense}/tracks=${report.trackCount}/missing=${report.missingTracks.join("|") || "none"}/extra=${report.extraTracks.join("|") || "none"}`).join(","),
  );
  record(
    "lesson.data.primary_context_actors_move",
    reports.every((report) => report.primaryActorCount === 5 && report.contextActorCount === 5 && report.primaryMovingActors === 5 && report.contextMovingActors === 5 && report.primaryMinTravel >= 5 && report.contextMinTravel >= 2),
    reports.map((report) => `${report.lessonId}:primary=${report.primaryMovingActors}/${report.primaryActorCount}@${report.primaryMinTravel}/context=${report.contextMovingActors}/${report.contextActorCount}@${report.contextMinTravel}`).join(","),
  );
  record(
    "lesson.data.ball_motion_traceable",
    reports.every((report) => report.ballEvents >= 2 && report.invalidBallRefs.length === 0),
    reports.map((report) => `${report.lessonId}:ball=${report.ballEvents}/invalid=${report.invalidBallRefs.join("|") || "none"}`).join(","),
  );
  record(
    "lesson.data.visual_annotations_traceable",
    reports.every((report) => report.arrowCount >= 2 && report.zoneCount >= 1 && report.invalidArrowRefs.length === 0),
    reports.map((report) => `${report.lessonId}:arrows=${report.arrowCount}/zones=${report.zoneCount}/invalid=${report.invalidArrowRefs.join("|") || "none"}`).join(","),
  );
  record(
    "lesson.data.action_grammar_traceable",
    reports.every((report) => report.actionCount >= 8 && report.invalidActionRefs.length === 0 && report.actionTypes.includes("pass") && report.hasMoveAction && report.hasDefenseReaction),
    reports.map((report) => `${report.lessonId}:actions=${report.actionCount}/types=${report.actionTypes.join("|")}/invalid=${report.invalidActionRefs.join("|") || "none"}`).join(","),
  );
  record(
    "lesson.data.beats_bind_actions",
    reports.every((report) => report.beatPhases.includes("problem") && report.beatPhases.includes("trigger") && report.beatPhases.includes("solution") && report.beatPhases.includes("reaction") && report.beatPhases.includes("cost") && report.beatsWithActions === report.beatCount),
    reports.map((report) => `${report.lessonId}:phases=${report.beatPhases.join("|")}/beats=${report.beatsWithActions}/${report.beatCount}`).join(","),
  );
  record(
    "lesson.data.risks_reuse_watchfor",
    reports.every((report) => report.riskTags.length > 0 && report.riskTags.every((tag) => report.watchFor.includes(tag))),
    reports.map((report) => `${report.lessonId}:risk=${report.riskTags.join("|")}/watch=${report.watchFor.join("|")}`).join(","),
  );
}

function analyzeFiveVsFiveLesson(lesson) {
  const timeline = lesson.timeline || {};
  const actors = timeline.actors || [];
  const actorIds = new Set(actors.map((actor) => actor.id));
  const trackIds = Object.keys(timeline.tracks || {});
  const missingTracks = actors.filter((actor) => !timeline.tracks?.[actor.id]).map((actor) => actor.id);
  const extraTracks = trackIds.filter((id) => !actorIds.has(id));
  const travelByActor = actors.map((actor) => ({ actor, travel: actorTravel(timeline.tracks?.[actor.id]) }));
  const primaryTravel = travelByActor.filter((entry) => !!entry.actor.primary).map((entry) => entry.travel);
  const contextTravel = travelByActor.filter((entry) => !entry.actor.primary).map((entry) => entry.travel);
  const sideCounts = actors.reduce((counts, actor) => {
    counts[actor.side] = (counts[actor.side] || 0) + 1;
    return counts;
  }, { offense: 0, defense: 0 });
  const invalidBallRefs = (timeline.ball || [])
    .filter((event) => event.holder && !actorIds.has(event.holder))
    .map((event) => event.holder);
  const invalidArrowRefs = (timeline.arrows || []).flatMap((arrow) => {
    const refs = [arrow.from, arrow.to].filter((ref) => typeof ref === "string" && !actorIds.has(ref));
    return refs.map((ref) => `${arrow.label || "arrow"}:${ref}`);
  });
  const actionTypes = [...new Set((timeline.actions || []).map((action) => action.type).filter(Boolean))];
  const invalidActionRefs = (timeline.actions || []).flatMap((action) => {
    const refs = [
      ...(action.actors || []),
      action.from,
      action.to,
    ].filter((ref) => typeof ref === "string" && !actorIds.has(ref));
    return refs.map((ref) => `${action.id || "action"}:${ref}`);
  });
  const beats = timeline.beats || [];
  const beatActionIds = new Set((timeline.actions || []).map((action) => action.id));
  const beatsWithActions = beats.filter((beat) => (beat.actionIds || []).length > 0 && (beat.actionIds || []).every((id) => beatActionIds.has(id))).length;
  const beatPhases = [...new Set(beats.map((beat) => beat.phase).filter(Boolean))];
  const riskTags = [...new Set((timeline.actions || []).map((action) => action.riskTag).filter(Boolean))];
  const causeTags = [...new Set((timeline.actions || []).map((action) => action.causeTag).filter(Boolean))];

  return {
    lessonId: lesson.lessonId,
    watchFor: lesson.watchFor || [],
    system: timeline.system || "",
    mode: timeline.mode || "",
    pureAnimation: !!timeline.pureAnimation,
    loop: !!timeline.loop,
    personnel: Number(timeline.personnel || 0),
    primaryPersonnel: Number(timeline.primaryPersonnel || 0),
    primarySide: timeline.primarySide || "",
    actorCount: actors.length,
    sideCounts,
    primaryActorCount: actors.filter((actor) => !!actor.primary).length,
    contextActorCount: actors.filter((actor) => !actor.primary).length,
    trackCount: trackIds.length,
    missingTracks,
    extraTracks,
    primaryMovingActors: primaryTravel.filter((value) => value > 0.5).length,
    contextMovingActors: contextTravel.filter((value) => value > 0.5).length,
    primaryMinTravel: Math.round(Math.min(...primaryTravel) * 10) / 10,
    contextMinTravel: Math.round(Math.min(...contextTravel) * 10) / 10,
    maxTravel: Math.round(Math.max(...travelByActor.map((entry) => entry.travel)) * 10) / 10,
    ballEvents: (timeline.ball || []).length,
    invalidBallRefs,
    arrowCount: (timeline.arrows || []).length,
    zoneCount: (timeline.zones || []).length,
    invalidArrowRefs,
    actionCount: (timeline.actions || []).length,
    actionTypes,
    hasMoveAction: actionTypes.some((type) => ["dribble", "cut", "roll", "handoff"].includes(type)),
    hasDefenseReaction: actionTypes.some((type) => ["help", "recover", "closeout", "stunt"].includes(type)),
    invalidActionRefs,
    beatCount: beats.length,
    beatsWithActions,
    beatPhases,
    causeTags,
    riskTags,
  };
}

function actorTravel(track) {
  if (!Array.isArray(track) || track.length < 2) return 0;
  const first = track[0];
  return Math.max(...track.map((point) => {
    const dx = (Number(point.x) || 0) - (Number(first.x) || 0);
    const dy = (Number(point.y) || 0) - (Number(first.y) || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }));
}

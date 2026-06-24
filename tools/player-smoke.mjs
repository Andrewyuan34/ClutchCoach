import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Module, createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));
const evidenceDir = path.resolve(root, args.get("out") || "snapshots/player-smoke");
const requestedPort = Number(args.get("port") || 0);
const seed = args.get("seed") || "demo-001";
const headless = args.get("headed") !== "true";

const result = {
  tool: "player-smoke",
  version: 1,
  root,
  seed,
  generatedAt: new Date().toISOString(),
  pass: false,
  checks: [],
  evidence: {},
  missingEvidence: [],
};

function record(id, pass, details = "") {
  result.checks.push({ id, pass: !!pass, details });
}

function summarizeState(state) {
  return {
    screen: state?.screen?.active,
    phase: state?.game?.phase,
    view: state?.game?.view,
    running: state?.game?.running,
    subWindow: state?.game?.subWindow,
    feedRows: state?.dom?.feedRows,
    tracedFeedRows: state?.dom?.tracedFeedRows,
    commandVisible: state?.command?.visible,
    commandSessionId: state?.command?.sessionId,
    commandStaffVisibleReads: state?.commandStaff?.visibleReads,
    commandAcceptedCost: state?.command?.commit?.acceptedCost,
    commandSummaryRows: state?.command?.commit?.summaryRows,
    commandDraftSpamRows: state?.command?.commit?.draftSpamRows,
    tacticLesson: state?.tacticLessons?.currentLesson ? {
      id: state.tacticLessons.currentLesson.id,
      system: state.tacticLessons.currentLesson.system,
      personnel: state.tacticLessons.currentLesson.personnel,
      primaryPersonnel: state.tacticLessons.currentLesson.primaryPersonnel,
      actorCount: state.tacticLessons.currentLesson.board?.actorCount,
      offense: state.tacticLessons.currentLesson.board?.sideCounts?.offense,
      defense: state.tacticLessons.currentLesson.board?.sideCounts?.defense,
      activeActions: state.tacticLessons.currentLesson.activeActions,
      beatPhase: state.tacticLessons.currentLesson.beatPhase,
      ball: state.tacticLessons.currentLesson.board?.ball,
    } : null,
    tacticalTrace: {
      livecastTrace: state?.tactical?.livecastTrace?.length || 0,
      debugEvents: state?.tactical?.debugEvents?.length || 0,
      activeAdjustmentWindows: state?.tactical?.activeAdjustmentWindows?.length || 0,
    },
    assertSummary: state?.assertSummary || null,
  };
}

function assertCheck(id, condition, details = "") {
  record(id, !!condition, details);
  if (!condition) throw new Error(`${id}: ${details}`);
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const { chromium } = await loadPlaywright();
  const server = await startStaticServer(requestedPort);
  const baseUrl = `http://127.0.0.1:${server.port}`;
  result.server = { url: baseUrl, requestedPort };

  let browser;
  try {
    const executablePath = args.get("browser-executable") || findBrowserExecutable();
    result.browser = { headless, executablePath: executablePath || "playwright-managed" };
    browser = await chromium.launch({
      headless,
      ...(executablePath ? { executablePath } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 1 });
    page.on("console", (msg) => {
      if (msg.type() === "error") result.missingEvidence.push(`browser_console_error:${msg.text()}`);
    });
    page.on("pageerror", (error) => {
      result.missingEvidence.push(`browser_page_error:${error.message}`);
    });

    const url = `${baseUrl}/live.html?ai_verify=1&seed=${encodeURIComponent(seed)}`;
    await page.goto(url, { waitUntil: "networkidle" });
    record("page.loaded", page.url().includes("/live.html"), page.url());
    await screenshot(page, "01-select");

    await clickTestId(page, "pick-team-spurs");
    await clickTestId(page, "start-game");
    await page.waitForSelector('[data-testid="coach-intro-modal"]:not(.hidden)', { timeout: 5000 });
    await screenshot(page, "02-coach-intro");
    await clickTestId(page, "coach-intro-start");

    await maybeCompleteAssistantIntro(page);
    await forceLiveMode(page);
    await page.waitForFunction(() => window.__NBA_LIVE_VERIFY__?.getState().game.phase === "live");
    const liveBefore = await readState(page);
    record("player.live_phase_before_timeout", liveBefore.game.phase === "live" && !liveBefore.command.visible, JSON.stringify(summarizeState(liveBefore)));
    await screenshot(page, "03-live-before-timeout");

    await clickTestId(page, "pause-toggle");
    await page.waitForFunction(() => window.__NBA_LIVE_VERIFY__?.getState().game.phase === "command");
    const commandBeforeHelp = await readState(page);
    record("player.command_visible_only_after_timeout", commandBeforeHelp.command.visible && commandBeforeHelp.game.subWindow, JSON.stringify(summarizeState(commandBeforeHelp)));
    record("player.recommendations_hidden_default", commandBeforeHelp.commandUi.recommendations.schemeBadgesVisible === 0 && !commandBeforeHelp.commandUi.recommendations.summaryMentionsRecommendation, JSON.stringify(commandBeforeHelp.commandUi.recommendations));
    await screenshot(page, "04-command-hidden-recommendations");

    await clickTestId(page, "coach-help-toggle");
    await page.waitForFunction(() => window.__NBA_LIVE_VERIFY__?.getState().commandStaff.visibleReads > 0);
    const commandWithHelp = await readState(page);
    record("player.assistant_help_shows_reads", commandWithHelp.commandStaff.visibleReads >= 1, JSON.stringify(commandWithHelp.commandStaff));
    await screenshot(page, "05-command-help");

    await adoptFirstStaffAdvice(page);
    await clickFirstExisting(page, [
      '[data-testid="scheme-off-paint"]',
      '[data-testid="scheme-off-motion"]',
      '[data-testid^="scheme-off-"]',
    ]);
    await clickFirstExisting(page, [
      '[data-testid="scheme-def-paint"]',
      '[data-testid="scheme-def-switch"]',
      '[data-testid^="scheme-def-"]',
    ]);
    const commandAfterDrafts = await readState(page);
    record("player.final_plan_has_cost_after_advice", !!commandAfterDrafts.commandStaff.acceptedCost || !commandAfterDrafts.commandStaff.visible, JSON.stringify(summarizeState(commandAfterDrafts)));
    await screenshot(page, "06-command-drafts");

    await openFirstLesson(page);
    await page.waitForFunction(() => {
      const lesson = window.__NBA_LIVE_VERIFY__?.getState().tacticLessons.currentLesson;
      return lesson?.board?.actorCount === 10 && lesson?.board?.ballPresent;
    });
    const lessonStart = await readState(page);
    const startActor = lessonStart.tacticLessons.currentLesson.board.actors[0];
    await screenshot(page, "07-tactic-board-start");
    await page.locator('[data-testid="tactic-lesson-scrubber"]').evaluate((el) => {
      el.value = String(Math.round(Number(el.max || 100) * 0.65));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(120);
    const lessonMoved = await readState(page);
    const movedActor = lessonMoved.tacticLessons.currentLesson.board.actors.find((actor) => actor.id === startActor.id);
    record(
      "player.tactic_board_drag_moves_actor_ball_actions",
      lessonMoved.tacticLessons.currentLesson.board.actorCount === 10 &&
        Math.abs((movedActor?.x || 0) - startActor.x) + Math.abs((movedActor?.y || 0) - startActor.y) > 0.2 &&
        !!lessonMoved.tacticLessons.currentLesson.board.ball &&
        lessonMoved.tacticLessons.currentLesson.board.activeActions.length > 0,
      JSON.stringify({
        startActor,
        movedActor,
        ball: lessonMoved.tacticLessons.currentLesson.board.ball,
        activeActions: lessonMoved.tacticLessons.currentLesson.board.activeActions,
        beatPhase: lessonMoved.tacticLessons.currentLesson.beatPhase,
      }),
    );
    await screenshot(page, "08-tactic-board-scrubbed");

    await clickTestId(page, "tactic-lesson-close");
    await clickTestId(page, "command-continue");
    await page.waitForFunction(() => window.__NBA_LIVE_VERIFY__?.getState().game.phase === "live");
    await page.waitForTimeout(600);
    const resumed = await readState(page);
    record("player.command_commit_single_summary_no_spam", resumed.command.commit.summaryRows === 1 && resumed.command.commit.draftSpamRows === 0, JSON.stringify(resumed.command.commit));
    record("player.livecast_trace_present", resumed.dom.feedRows === resumed.dom.tracedFeedRows, JSON.stringify({
      feedRows: resumed.dom.feedRows,
      tracedFeedRows: resumed.dom.tracedFeedRows,
      lastFeedTrace: resumed.dom.lastFeedTrace,
    }));
    record("player.tactical_debug_trace_present", resumed.tactical.livecastTrace.length > 0 && resumed.tactical.debugEvents.length > 0, JSON.stringify(resumed.tactical));
    const assertSummary = await page.evaluate(() => window.__NBA_LIVE_VERIFY__.getAssertSummary());
    record("player.assert_summary_pass", assertSummary.pass, JSON.stringify(assertSummary));
    await screenshot(page, "09-live-resumed");

    const motionSample = await page.evaluate(() => window.__NBA_LIVE_VERIFY__.sampleTacticLessonMotion("motion", [0, 1800, 3600, 5400]));
    record("player.motion_sample_traceable", motionSample?.frames?.length === 4 && motionSample?.sideCounts?.offense === 5 && motionSample?.sideCounts?.defense === 5, JSON.stringify({
      system: motionSample?.system,
      sideCounts: motionSample?.sideCounts,
      actionTypes: motionSample?.actionTypes,
      ballHolders: motionSample?.ballHolders,
    }));

    const finalState = await readState(page);
    result.evidence.url = url;
    result.evidence.stateSummary = summarizeState({ ...finalState, assertSummary });
    result.evidence.motionSample = {
      lessonId: motionSample?.lessonId,
      system: motionSample?.system,
      sideCounts: motionSample?.sideCounts,
      actionTypes: motionSample?.actionTypes,
      sampleMs: motionSample?.sampleMs,
      maxActorTravel: motionSample?.maxActorTravel,
      frameCount: motionSample?.frames?.length || 0,
    };
  } finally {
    if (browser) await browser.close();
    await server.close();
  }

  result.pass = result.checks.every((check) => check.pass) && result.missingEvidence.length === 0;
  await writeEvidence();
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}

async function loadPlaywright() {
  const runtimeNodeModules = path.join(process.env.USERPROFILE || "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules");
  const pnpmNodeModules = path.join(runtimeNodeModules, ".pnpm", "node_modules");
  process.env.NODE_PATH = [process.env.NODE_PATH, runtimeNodeModules, pnpmNodeModules].filter(Boolean).join(path.delimiter);
  Module._initPaths();
  const require = createRequire(import.meta.url);
  const candidates = ["playwright", path.join(runtimeNodeModules, "playwright", "index.js")];
  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`playwright_import_failed:${candidate}:${error.message}`);
    }
  }
  result.missingEvidence.push(...failures);
  throw new Error("Playwright is unavailable; cannot generate player-path browser evidence.");
}

function findBrowserExecutable() {
  const candidates = [
    process.env.PLAYER_SMOKE_BROWSER,
    process.env.CHROME_PATH,
    path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function startStaticServer(port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/live.html" : url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const type = ext === ".html" ? "text/html; charset=utf-8"
      : ext === ".css" ? "text/css; charset=utf-8"
      : ext === ".mjs" || ext === ".js" ? "text/javascript; charset=utf-8"
      : "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        port: server.address().port,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

async function maybeCompleteAssistantIntro(page) {
  const tutorialVisible = await page.locator('[data-testid="coach-tutorial-modal"]:not(.hidden)').count();
  if (!tutorialVisible) return;
  await page.evaluate(() => {
    localStorage.setItem("clutchCoachAssistantDone", "1");
    window.location.reload();
  });
  await page.waitForLoadState("networkidle");
  await clickTestId(page, "pick-team-spurs");
  await clickTestId(page, "start-game");
  await page.waitForSelector('[data-testid="coach-intro-modal"]:not(.hidden)', { timeout: 5000 });
  await clickTestId(page, "coach-intro-start");
}

async function forceLiveMode(page) {
  await page.waitForFunction(() => window.__NBA_LIVE_VERIFY__?.getState().screen.active === "game");
  await page.evaluate(() => {
    const verify = window.__NBA_LIVE_VERIFY__;
    if (!verify) return;
    const state = verify.getState();
    if (state.tutorial.open) {
      const modal = document.getElementById("coach-tutorial-modal");
      if (modal) modal.classList.add("hidden");
    }
    verify.sync("player-smoke:force-live");
  });
}

async function adoptFirstStaffAdvice(page) {
  const action = page.locator("#command-staff-reads .staff-read[data-ai-aligned='true'] .staff-read-action[data-advice-id]").first();
  if (await action.count()) {
    await action.click();
    await page.waitForTimeout(120);
    await page.waitForFunction(() => !!window.__NBA_LIVE_VERIFY__?.getState().commandStaff.acceptedCost);
  } else {
    result.missingEvidence.push("staff_advice_action_not_found");
  }
}

async function openFirstLesson(page) {
  const lesson = page.locator('[data-testid^="lesson-open-"]').first();
  if (await lesson.count()) {
    await lesson.click();
    return;
  }
  await page.evaluate(() => {
    const lessonId = window.__NBA_LIVE_VERIFY__?.getState().tacticLessons.available[0] || "motion";
    const btn = document.querySelector(`[data-testid="lesson-open-${lessonId}"]`);
    if (btn) btn.click();
  });
}

async function clickFirstExisting(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      await locator.click();
      await page.waitForTimeout(80);
      return selector;
    }
  }
  result.missingEvidence.push(`selector_not_found:${selectors.join("|")}`);
  return "";
}

async function clickTestId(page, testId) {
  await page.locator(`[data-testid="${testId}"]`).click({ timeout: 5000 });
  await page.waitForTimeout(80);
}

async function readState(page) {
  return page.evaluate(() => {
    const verify = window.__NBA_LIVE_VERIFY__;
    return verify ? verify.getState() : null;
  });
}

async function screenshot(page, name) {
  const file = path.join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  result.evidence[name] = path.relative(root, file).replace(/\\/g, "/");
}

async function writeEvidence() {
  const file = path.join(evidenceDir, "player-smoke.json");
  await writeFile(file, JSON.stringify(result, null, 2), "utf8");
  result.evidence.json = path.relative(root, file).replace(/\\/g, "/");
}

main().catch(async (error) => {
  result.pass = false;
  result.error = error instanceof Error ? error.stack || error.message : String(error);
  try {
    await writeEvidence();
  } catch {}
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
});

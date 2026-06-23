import { TACTIC_LESSONS } from "../data/tactical-data.mjs?v=action-motion-33";
import { S } from "../state.mjs?v=action-motion-33";
import { $ } from "../utils.mjs?v=action-motion-33";
import {
  commandAdviceForSession,
  commandDecisionText,
  commandResolvedWindow,
  commandResultText,
  costLabel,
  roleLabel,
  watchForLabel,
} from "./command-center.mjs?v=action-motion-33";
import { lessonIdForAdvice, openTacticLesson } from "./tactic-board.mjs?v=action-motion-33";

export function buildPostgameRecapItems(limit = 2) {
  const sessions = (S.commandHistory || []).filter((session) => session?.committedPlan);
  const items = sessions.map((session, index) => {
    const plan = session.committedPlan;
    const advice = commandAdviceForSession(session);
    const resolved = commandResolvedWindow(plan);
    const feedbackRows = Array.isArray(session.feedbackRows) ? session.feedbackRows : [];
    const watchFor = (plan.watchFor?.length ? plan.watchFor : advice?.watchFor || []).slice(0, 3);
    const lessonId = plan.lessonId || lessonIdForAdvice(advice);
    const result = resolved?.result || (feedbackRows.length ? "partial" : "pending");
    const feedbackText = feedbackRows.slice(-1)[0]?.text || commandResultText(result);
    const score = (plan.acceptedCost ? 4 : 0) + (feedbackRows.length ? 3 : 0) +
      (resolved ? 3 : 0) + (lessonId ? 1 : 0) + (session.by === S.myTeam ? 1 : 0);
    return {
      id: session.id,
      openedAt: session.openedAt || {},
      openedTick: session.openedAt?.tick ?? index,
      problem: session.staffBriefing?.primaryProblemText || session.reasonText || "这次暂停处理了一段场上问题。",
      primaryProblem: session.staffBriefing?.primaryProblem || "",
      decision: commandDecisionText(session, advice),
      adoptedAdviceId: plan.adoptedAdviceId || "",
      staffRole: advice ? roleLabel(advice.role) : "",
      acceptedCost: plan.acceptedCost || "",
      acceptedCostText: plan.acceptedCostText || (plan.acceptedCost ? costLabel(plan.acceptedCost) : "未记录代价"),
      watchFor,
      watchForText: watchFor.map(watchForLabel).join("；") || "下次继续看执行质量",
      result,
      resultText: commandResultText(result),
      feedbackText,
      lessonId,
      lessonTitle: lessonId ? TACTIC_LESSONS[lessonId]?.title || "" : "",
      coachActionId: plan.coachActionId || "",
      adjustmentId: plan.adjustmentId || "",
      summaryLivecastId: plan.livecastId || "",
      sourceLivecastIds: session.sourceLivecastIds || [],
      sourceContextIds: session.sourceContextIds || [],
      feedbackLivecastIds: feedbackRows.map((row) => row.livecastId).filter(Boolean),
      score,
    };
  }).filter((item) => item.acceptedCost || item.feedbackLivecastIds.length || item.adoptedAdviceId);

  const selected = items
    .sort((a, b) => b.score - a.score || b.openedTick - a.openedTick)
    .slice(0, limit)
    .sort((a, b) => a.openedTick - b.openedTick)
    .map(({ score, ...item }) => item);
  S.postgameRecap = selected;
  return selected;
}

export function renderPostCoachRecap() {
  const box = $("post-coach-recap");
  if (!box) return;
  const items = buildPostgameRecapItems(2);
  if (!items.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML =
    `<div class="post-recap-title">教练组复盘</div>` +
    items.map((item, idx) => {
      const lessonButton = item.lessonId
        ? `<button class="post-recap-lesson" data-testid="post-recap-lesson" data-lesson-id="${item.lessonId}" type="button">看战术板</button>`
        : "";
      return `<div class="post-recap-item" data-testid="post-recap-item"` +
        ` data-ai-command-session-id="${item.id}"` +
        ` data-ai-coach-action-id="${item.coachActionId}"` +
        ` data-ai-adjustment-id="${item.adjustmentId}"` +
        ` data-ai-adopted-advice-id="${item.adoptedAdviceId}"` +
        ` data-ai-accepted-cost="${item.acceptedCost}"` +
        ` data-ai-lesson-id="${item.lessonId}"` +
        ` data-ai-result="${item.result}">` +
          `<div class="post-recap-head"><b>${idx + 1}. ${item.problem}</b><span>${item.result === "success" ? "兑现" : item.result === "failed" ? "付账" : "待复看"}</span></div>` +
          `<div class="post-recap-line">你选择：${item.decision}</div>` +
          `<div class="post-recap-line">接受代价：${item.acceptedCostText}</div>` +
          `<div class="post-recap-feedback">${item.feedbackText}</div>` +
          `<div class="post-recap-foot"><span>下次观察：${item.watchForText}</span>${lessonButton}</div>` +
        `</div>`;
    }).join("");
  box.querySelectorAll(".post-recap-lesson").forEach((btn) => {
    btn.onclick = () => openTacticLesson(btn.dataset.lessonId, "postgame-recap");
  });
}

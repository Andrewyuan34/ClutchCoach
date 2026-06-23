import { S } from "../state.mjs?v=action-motion-33";
import { clone, isVisible } from "./dom-utils.mjs?v=action-motion-33";

export function commandRecommendationSignals() {
  const schemeBadgesVisible = [...document.querySelectorAll(".sch-btn[data-ai-recommendation-visible='true']")]
    .filter(isVisible).length;
  const summaryMentionsRecommendation = [
    document.getElementById("offense-summary"),
    document.getElementById("defense-summary"),
  ].some((el) => isVisible(el) && (el.innerText || "").includes("推荐"));
  const lineupTitle = document.querySelector("#command-lineup-recommendations .lineup-rec-title");
  const lineupRecommendationVisible = isVisible(lineupTitle) && (lineupTitle.innerText || "").includes("推荐");
  return {
    schemeBadgesVisible,
    summaryMentionsRecommendation,
    lineupRecommendationVisible,
  };
}

export function commandStaffSignals() {
  const wrap = document.getElementById("command-staff");
  const problemEl = document.getElementById("command-staff-problem");
  const readEls = [...document.querySelectorAll("#command-staff-reads .staff-read[data-ai-advice-id]")];
  const session = S.commandSession || null;
  const last = S.lastCommandSession || null;
  const briefing = session?.staffBriefing || last?.staffBriefing || null;
  const finalCostText = document.getElementById("command-final-cost")?.innerText.trim() || "";
  const inActiveCommand = !!session && isVisible(wrap);
  const activeSessionAdvice = finalCostText && !finalCostText.includes("待拍板") ? (session?.adoptedAdviceId || "") : "";
  const adoptedAdviceId = inActiveCommand ? activeSessionAdvice : (last?.committedPlan?.adoptedAdviceId || "");
  return {
    visible: isVisible(wrap),
    primaryProblem: wrap?.dataset.aiPrimaryProblem || briefing?.primaryProblem || "",
    primaryProblemText: problemEl?.innerText.trim() || briefing?.primaryProblemText || "",
    sourceLivecastIds: clone(briefing?.sourceLivecastIds || session?.sourceLivecastIds || []),
    sourceContextIds: clone(briefing?.sourceContextIds || session?.sourceContextIds || []),
    visibleReads: Number(wrap?.dataset.aiVisibleReads || 0),
    reads: readEls.map((el) => ({
      adviceId: el.dataset.aiAdviceId || "",
      role: el.dataset.aiRole || "",
      cost: el.dataset.aiCost || "",
      adopted: el.dataset.aiAdopted === "true",
      aligned: el.dataset.aiAligned === "true",
      text: (el.innerText || "").trim(),
    })),
    adoptedAdviceId,
    acceptedCost: inActiveCommand ? (activeSessionAdvice ? (session?.acceptedCost || "") : "") : (last?.committedPlan?.acceptedCost || ""),
    finalCostText,
  };
}


export function commandLineupSignals() {
  const recBox = document.getElementById("command-lineup-recommendations");
  const confirmed = recBox?.querySelector(".lineup-rec.confirmed") || null;
  return {
    confirmationVisible: isVisible(confirmed),
    confirmationText: confirmed ? (confirmed.innerText || "").trim() : "",
    applyVisible: isVisible(document.getElementById("command-lineup-apply")),
  };
}

export function commandPanelMetrics() {
  const panel = document.getElementById("cmd-wrap");
  if (!panel) return { clientHeight: 0, scrollHeight: 0, scrollTop: 0, firstScreenFits: false };
  return {
    clientHeight: panel.clientHeight || 0,
    scrollHeight: panel.scrollHeight || 0,
    scrollTop: panel.scrollTop || 0,
    firstScreenFits: (panel.scrollHeight || 0) <= (panel.clientHeight || 0) + 1,
  };
}

export function commandCommitSignals(feedRowsArg = null) {
  const rows = feedRowsArg ? [...feedRowsArg] : [...document.querySelectorAll("#feed .feed-row")];
  const last = S.lastCommandSession || null;
  const plan = last?.committedPlan || null;
  const coachActionId = plan?.coachActionId || last?.commitTrace?.coachActionId || "";
  const summaryLivecastId = plan?.livecastId || last?.commitTrace?.livecastId || "";
  const acceptedCost = plan?.acceptedCost || last?.commitTrace?.acceptedCost || "";
  const acceptedCostText = plan?.acceptedCostText || "";
  const summaryRows = summaryLivecastId
    ? rows.filter((row) => row.dataset.aiLivecastId === summaryLivecastId && (row.innerText || "").includes("最终布置"))
    : [];
  const logicalSummaryRows = summaryRows.length || (summaryLivecastId && plan?.summaryText ? 1 : 0);
  const commitRows = coachActionId
    ? rows.filter((row) => row.dataset.aiCoachActionId === coachActionId)
    : [];
  const feedbackRows = commitRows.filter((row) => {
    const source = row.dataset.aiTraceSource || "";
    const kind = row.dataset.aiFeedbackKind || "";
    return kind !== "command_summary" && (kind || source === "command-feedback" || source === "adjustment");
  });
  const feedbackReferencesAcceptedCost = !acceptedCost || feedbackRows.some((row) => {
    const bodyText = row.innerText || "";
    return row.dataset.aiAcceptedCost === acceptedCost || (!!acceptedCostText && bodyText.includes(acceptedCostText));
  });
  const draftSpam = commandDraftSpamRows(rows, last?.drafts || []);
  return {
    hasLastCommitted: !!last?.committed,
    hasCommittedPlan: !!plan,
    coachActionId,
    adjustmentId: plan?.adjustmentId || last?.commitTrace?.adjustmentId || "",
    livecastId: summaryLivecastId,
    adoptedAdviceId: plan?.adoptedAdviceId || "",
    acceptedCost,
    acceptedCostText,
    watchFor: clone(plan?.watchFor || []),
    lessonId: plan?.lessonId || last?.commitTrace?.lessonId || "",
    summaryText: plan?.summaryText || "",
    summaryRows: logicalSummaryRows,
    commitRows: commitRows.length,
    feedbackRows: feedbackRows.length,
    feedbackKinds: feedbackRows.map((row) => row.dataset.aiFeedbackKind || row.dataset.aiTraceSource || ""),
    feedbackReferencesAcceptedCost,
    summaryTracePresent: summaryRows.some((row) => !!row.dataset.aiLivecastId && !!row.dataset.aiAdjustmentId) || (!!summaryLivecastId && !!(plan?.adjustmentId || last?.commitTrace?.adjustmentId)),
    draftCount: Array.isArray(last?.drafts) ? last.drafts.length : 0,
    draftSpamRows: draftSpam.length,
    draftSpamText: draftSpam.slice(0, 3),
  };
}

function commandDraftSpamRows(rows, drafts) {
  if (!Array.isArray(drafts) || !drafts.length) return [];
  const texts = rows.map((row) => row.innerText || "");
  const hits = [];
  drafts.forEach((draft) => {
    const payload = draft.payload || {};
    if (draft.type === "scheme" && payload.toName) {
      const directSchemeText = [`我方改打【${payload.toName}】`, `防守切换【${payload.toName}】`, `教练调整：${payload.kind === "off" ? "进攻" : "防守"}切到【${payload.toName}】`];
      texts.forEach((rowText) => {
        if (directSchemeText.some((pattern) => rowText.includes(pattern))) hits.push(rowText);
      });
    }
    if (draft.type === "substitution" && payload.inName && payload.outName) {
      const subText = `换人：${payload.inName} 换下 ${payload.outName}`;
      texts.forEach((rowText) => {
        if (rowText.includes(subText)) hits.push(rowText);
      });
    }
  });
  return [...new Set(hits)];
}

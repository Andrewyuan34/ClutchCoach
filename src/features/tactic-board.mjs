import { TACTIC_LESSONS } from "../data/tactical-data.mjs?v=action-motion-33";
import { S } from "../state.mjs?v=action-motion-33";
import { $, clamp } from "../utils.mjs?v=action-motion-33";
import { syncAiVerification } from "../ai-verify.mjs?v=action-motion-33";

let tacticLessonRaf = null;
let watchForLabel = (tag) => tag;

export function initTacticBoardFeature({ watchForLabel: watchForLabelFn } = {}) {
  if (typeof watchForLabelFn === "function") watchForLabel = watchForLabelFn;
  const close = $("tactic-lesson-close");
  const autoplay = $("tactic-lesson-autoplay");
  const scrubber = $("tactic-lesson-scrubber");
  if (close) close.onclick = () => closeTacticLesson();
  if (autoplay) autoplay.onclick = () => toggleTacticLessonAuto();
  if (scrubber) scrubber.oninput = (e) => seekTacticLesson(Number(e.target.value || 0));
}

export function lessonForScheme(kind, key) {
  return Object.values(TACTIC_LESSONS).find((lesson) => lesson.kind === kind && lesson.key === key) || null;
}

export function lessonIdForAdvice(advice) {
  const rec = advice?.recommendation || {};
  return lessonForScheme(rec.kind, rec.key)?.lessonId || "";
}

export function openTacticLesson(lessonId, openedFrom = "scheme-card") {
  const lesson = TACTIC_LESSONS[lessonId];
  if (!lesson || (!S.subWindow && S.phase !== "postgame")) return;
  stopTacticLessonAuto();
  S.tacticLesson = {
    lessonId,
    frameIndex: 0,
    playheadMs: 0,
    openedFrom,
    autoPlaying: false,
    lastAutoAt: 0,
    lastSyncAt: 0,
    openedAt: { quarter: S.quarter, clock: S.clock, tick: S.tickCount },
  };
  markTacticLessonFrame(lessonId, 0);
  renderTacticLessonModal();
  toggleTacticLessonAuto({ sync: false });
  syncAiVerification(`lesson:open:${lessonId}`);
}

export function closeTacticLesson({ sync = true } = {}) {
  stopTacticLessonAuto();
  S.tacticLesson = null;
  const modal = $("tactic-lesson-modal");
  if (modal) modal.classList.add("hidden");
  if (sync) syncAiVerification("lesson:close");
}

export function seekTacticLesson(ms) {
  const state = S.tacticLesson;
  const lesson = state ? TACTIC_LESSONS[state.lessonId] : null;
  if (!state || !lesson) return;
  stopTacticLessonAuto();
  state.playheadMs = clamp(Number(ms) || 0, 0, lessonDuration(lesson));
  state.frameIndex = activeBeatIndex(lesson, state.playheadMs);
  markTacticLessonFrame(state.lessonId, state.frameIndex);
  renderTacticLessonModal();
  syncAiVerification(`lesson:seek:${state.lessonId}:${Math.round(state.playheadMs)}`);
}

export function toggleTacticLessonAuto({ sync = true } = {}) {
  const state = S.tacticLesson;
  if (!state) return;
  if (state.autoPlaying) {
    stopTacticLessonAuto();
    renderTacticLessonModal();
    if (sync) syncAiVerification("lesson:auto:off");
    return;
  }
  const lesson = TACTIC_LESSONS[state.lessonId];
  if (!lesson) return;
  if ((state.playheadMs || 0) >= lessonDuration(lesson) - 30) {
    state.playheadMs = 0;
    state.frameIndex = 0;
  }
  state.autoPlaying = true;
  state.lastAutoAt = performance.now();
  state.lastSyncAt = state.lastAutoAt;
  renderTacticLessonModal();
  tacticLessonRaf = requestAnimationFrame(tickTacticLessonAuto);
  if (sync) syncAiVerification("lesson:auto:on");
}

export function stopTacticLessonAuto() {
  if (tacticLessonRaf) cancelAnimationFrame(tacticLessonRaf);
  tacticLessonRaf = null;
  if (S.tacticLesson) S.tacticLesson.autoPlaying = false;
}

function tickTacticLessonAuto(now) {
  const state = S.tacticLesson;
  const lesson = state ? TACTIC_LESSONS[state.lessonId] : null;
  if (!state?.autoPlaying || !lesson) { stopTacticLessonAuto(); return; }
  const duration = lessonDuration(lesson);
  const prev = state.lastAutoAt || now;
  const delta = Math.max(0, Math.min(120, now - prev));
  state.lastAutoAt = now;
  state.playheadMs = clamp((state.playheadMs || 0) + delta, 0, duration);
  const beatIndex = activeBeatIndex(lesson, state.playheadMs);
  if (beatIndex !== state.frameIndex) {
    state.frameIndex = beatIndex;
    markTacticLessonFrame(state.lessonId, beatIndex);
  }
  renderTacticLessonModal();
  if (now - (state.lastSyncAt || 0) >= 250) {
    state.lastSyncAt = now;
    syncAiVerification(`lesson:auto:tick:${state.lessonId}:${Math.round(state.playheadMs)}`);
  }
  if (state.playheadMs >= duration) {
    if (lesson.timeline?.loop) {
      state.playheadMs = 0;
      state.frameIndex = 0;
      state.lastAutoAt = now;
      state.lastSyncAt = now;
      markTacticLessonFrame(state.lessonId, 0);
      renderTacticLessonModal();
      syncAiVerification(`lesson:auto:loop:${state.lessonId}`);
    } else {
      stopTacticLessonAuto();
      renderTacticLessonModal();
      syncAiVerification(`lesson:auto:complete:${state.lessonId}`);
      return;
    }
  }
  tacticLessonRaf = requestAnimationFrame(tickTacticLessonAuto);
}

function markTacticLessonFrame(lessonId, frameIndex) {
  const lesson = TACTIC_LESSONS[lessonId];
  if (!lesson) return;
  if (!S.learnedTactics) S.learnedTactics = {};
  const prev = S.learnedTactics[lessonId] || {};
  const framesSeen = Array.isArray(prev.framesSeen) ? prev.framesSeen.slice() : [];
  if (!framesSeen.includes(frameIndex)) framesSeen.push(frameIndex);
  const beatCount = lessonBeats(lesson).length;
  S.learnedTactics[lessonId] = {
    ...prev,
    lessonId,
    framesSeen: framesSeen.sort((a, b) => a - b),
    watched: framesSeen.length >= beatCount,
    lastWatchedAt: { gameNo: S.gameNo, quarter: S.quarter, clock: S.clock, tick: S.tickCount },
  };
}

function renderTacticLessonModal() {
  const modal = $("tactic-lesson-modal");
  const state = S.tacticLesson;
  const lesson = state ? TACTIC_LESSONS[state.lessonId] : null;
  if (!modal || !lesson) {
    if (modal) modal.classList.add("hidden");
    return;
  }
  const duration = lessonDuration(lesson);
  const playhead = clamp(state.playheadMs || 0, 0, duration);
  const beats = lessonBeats(lesson);
  const index = activeBeatIndex(lesson, playhead);
  const frame = lessonFrameForBeat(lesson, index);
  const beat = beats[index] || { label: frame.label, text: frame.text, t: playhead };
  const activeActions = activeTacticActions(lesson, playhead);
  const beatPhase = beat.phase || "motion";
  const actionTypes = [...new Set((lesson.timeline?.actions || []).map((action) => action.type).filter(Boolean))];
  const activeActionTypes = [...new Set(activeActions.map((action) => action.type).filter(Boolean))];
  const causeTags = tacticActionTags(lesson, "causeTag");
  const riskTags = tacticActionTags(lesson, "riskTag");
  state.frameIndex = index;
  state.playheadMs = playhead;
  modal.classList.remove("hidden");
  modal.dataset.aiSystem = lesson.timeline?.system || "";
  modal.dataset.aiLessonId = lesson.lessonId;
  modal.dataset.aiFrameIndex = String(index);
  modal.dataset.aiFrameCount = String(beats.length);
  modal.dataset.aiPlayheadMs = String(Math.round(playhead));
  modal.dataset.aiDurationMs = String(duration);
  modal.dataset.aiTimelineActors = String(lesson.timeline?.actors?.length || 0);
  modal.dataset.aiMovingActors = String(countMovingActors(lesson));
  modal.dataset.aiBallTransfers = String(Math.max(0, (lesson.timeline?.ball?.length || 1) - 1));
  modal.dataset.aiCostPath = (lesson.timeline?.costPath || []).join(" ");
  modal.dataset.aiPureAnimation = String(!!lesson.timeline?.pureAnimation);
  modal.dataset.aiPersonnel = String(lesson.timeline?.personnel || lesson.timeline?.actors?.length || 0);
  modal.dataset.aiPrimaryPersonnel = String(lesson.timeline?.primaryPersonnel || countPrimaryActors(lesson));
  modal.dataset.aiPrimarySide = lesson.timeline?.primarySide || "";
  modal.dataset.aiSubject = lesson.timeline?.subject || "";
  modal.dataset.aiActionCount = String(lesson.timeline?.actions?.length || 0);
  modal.dataset.aiActiveActions = activeActions.map((action) => action.id).join(" ");
  modal.dataset.aiActionTypes = actionTypes.join(" ");
  modal.dataset.aiActiveActionTypes = activeActionTypes.join(" ");
  modal.dataset.aiBeatPhase = beatPhase;
  modal.dataset.aiCauseTags = causeTags.join(" ");
  modal.dataset.aiRiskTags = riskTags.join(" ");
  modal.dataset.aiWatchFor = lesson.watchFor.join(" ");
  modal.dataset.aiOpenedFrom = state.openedFrom || "";
  if ($("tactic-lesson-title")) $("tactic-lesson-title").textContent = lesson.title;
  if ($("tactic-lesson-intent")) $("tactic-lesson-intent").textContent = tacticLessonBeatText(beat, frame, activeActions);
  const board = $("tactic-lesson-board");
  if (board) {
    board.innerHTML = renderTacticBoard(lesson, playhead);
    board.dataset.aiSystem = lesson.timeline?.system || "";
    board.dataset.aiPlayheadMs = String(Math.round(playhead));
    board.dataset.aiDurationMs = String(duration);
    board.dataset.aiTimelineActors = String(lesson.timeline?.actors?.length || 0);
    board.dataset.aiPersonnel = String(lesson.timeline?.personnel || lesson.timeline?.actors?.length || 0);
    board.dataset.aiPrimaryPersonnel = String(lesson.timeline?.primaryPersonnel || countPrimaryActors(lesson));
    board.dataset.aiPrimarySide = lesson.timeline?.primarySide || "";
    const sideCounts = countActorsBySide(lesson.timeline?.actors || []);
    board.dataset.aiOffenseCount = String(sideCounts.offense || 0);
    board.dataset.aiDefenseCount = String(sideCounts.defense || 0);
    board.dataset.aiPrimaryActorCount = String(countPrimaryActors(lesson));
    board.dataset.aiContextActorCount = String((lesson.timeline?.actors?.length || 0) - countPrimaryActors(lesson));
    board.dataset.aiPureAnimation = String(!!lesson.timeline?.pureAnimation);
    board.dataset.aiActiveArrows = String((lesson.timeline?.arrows || []).filter((arrow) => playhead >= arrow.tStart && playhead <= arrow.tEnd).length);
    board.dataset.aiActionCount = String(lesson.timeline?.actions?.length || 0);
    board.dataset.aiActiveActions = activeActions.map((action) => action.id).join(" ");
    board.dataset.aiActiveActionTypes = activeActionTypes.join(" ");
    board.dataset.aiBeatPhase = beatPhase;
    board.dataset.aiCauseTags = causeTags.join(" ");
    board.dataset.aiRiskTags = riskTags.join(" ");
    board.dataset.aiActiveZones = String((lesson.timeline?.zones || []).filter((zone) => playhead >= zone.tStart && playhead <= zone.tEnd).length);
    board.dataset.aiBallTransfers = String(Math.max(0, (lesson.timeline?.ball?.length || 1) - 1));
  }
  const scrub = $("tactic-lesson-scrubber");
  if (scrub) {
    scrub.max = String(duration);
    scrub.value = String(Math.round(playhead));
  }
  if ($("tactic-lesson-time")) $("tactic-lesson-time").textContent = `${(playhead / 1000).toFixed(1)}s / ${(duration / 1000).toFixed(1)}s`;
  if ($("tactic-lesson-markers")) $("tactic-lesson-markers").innerHTML = renderTacticLessonMarkers(lesson, playhead, duration);
  const auto = $("tactic-lesson-autoplay");
  if (auto) auto.textContent = state.autoPlaying ? "暂停" : (playhead >= duration - 30 ? "重播跑位" : "播放跑位");
}

function lessonDuration(lesson) {
  return Math.max(1, Number(lesson.timeline?.durationMs || 0) || ((lesson.frames?.length || 1) - 1) * 1400 || 4200);
}

function lessonBeats(lesson) {
  const beats = lesson.timeline?.beats;
  if (beats?.length) return beats;
  return (lesson.frames || []).map((frame, idx) => ({ t: idx * 1400, label: frame.label, text: frame.text }));
}

function activeBeatIndex(lesson, playhead) {
  const beats = lessonBeats(lesson);
  let index = 0;
  beats.forEach((beat, idx) => {
    if ((beat.t || 0) <= playhead + 10) index = idx;
  });
  return clamp(index, 0, beats.length - 1);
}

function lessonFrameForBeat(lesson, index) {
  return lesson.frames?.[Math.min(index, lesson.frames.length - 1)] || {
    label: lessonBeats(lesson)[index]?.label || "跑位",
    title: lessonBeats(lesson)[index]?.label || lesson.title,
    text: lessonBeats(lesson)[index]?.text || lesson.intent,
    focus: lesson.watchFor?.map(watchForLabel).join(" / ") || "",
  };
}

function countMovingActors(lesson) {
  const tracks = lesson.timeline?.tracks || {};
  return Object.values(tracks).filter((track) => {
    if (!Array.isArray(track) || track.length < 2) return false;
    const first = track[0];
    return track.some((point) => Math.abs((point.x || 0) - (first.x || 0)) > 0.5 || Math.abs((point.y || 0) - (first.y || 0)) > 0.5);
  }).length;
}

function activeTacticActions(lesson, playhead) {
  return (lesson.timeline?.actions || []).filter((action) => playhead >= action.tStart && playhead <= action.tEnd);
}

function tacticActionTags(lesson, key) {
  return [...new Set((lesson.timeline?.actions || []).map((action) => action[key]).filter(Boolean))];
}

function tacticLessonBeatText(beat, frame, activeActions) {
  const phase = tacticPhaseLabel(beat.phase);
  const actionText = activeActions.length
    ? `当前：${activeActions.slice(0, 3).map((action) => tacticActionLabel(action.type)).join(" / ")}`
    : "当前：跑位复位";
  return `${phase} · ${beat.label || frame.label} · ${beat.text || frame.text} · ${actionText}`;
}

function tacticPhaseLabel(phase) {
  return {
    problem: "问题",
    trigger: "触发",
    solution: "解法",
    reaction: "反应",
    cost: "代价",
  }[phase] || "跑位";
}

function tacticActionLabel(type) {
  return {
    pass: "传球",
    dribble: "运球",
    cut: "空切",
    screen: "掩护",
    roll: "顺下",
    handoff: "手递手",
    help: "协防",
    recover: "回位",
    closeout: "扑防",
    stunt: "施压",
  }[type] || "移动";
}

function renderTacticLessonMarkers(lesson, playhead, duration) {
  return lessonBeats(lesson).map((beat) => {
    const left = clamp(((beat.t || 0) / Math.max(1, duration)) * 100, 0, 100);
    const active = Math.abs((beat.t || 0) - (lessonBeats(lesson)[activeBeatIndex(lesson, playhead)]?.t || 0)) < 1;
    return `<span class="${active ? "active" : ""}" data-ai-beat-phase="${beat.phase || ""}" data-ai-beat-t="${beat.t || 0}" style="left:${left}%"><i></i><b>${tacticPhaseLabel(beat.phase)}</b></span>`;
  }).join("");
}

function countActorsBySide(actors = []) {
  return actors.reduce((counts, actor) => {
    const side = actor.side || "unknown";
    counts[side] = (counts[side] || 0) + 1;
    return counts;
  }, {});
}

function countPrimaryActors(lesson) {
  return (lesson.timeline?.actors || []).filter((actor) => !!actor.primary).length;
}

function renderTacticBoard(lesson, playhead) {
  const timeline = lesson.timeline;
  if (!timeline?.actors?.length) return renderStaticTacticBoard(lesson.frames?.[activeBeatIndex(lesson, playhead)] || lesson.frames?.[0] || {});
  const positions = actorPositions(lesson, playhead);
  const zones = (timeline.zones || []).filter((zone) => playhead >= zone.tStart && playhead <= zone.tEnd).map(tacticZone).join("");
  const actions = activeTacticActions(lesson, playhead);
  const arrows = actions.length
    ? actions.map((action) => boardAction(action, lesson, positions, playhead)).join("")
    : (timeline.arrows || []).filter((arrow) => playhead >= arrow.tStart && playhead <= arrow.tEnd).map((arrow) => boardArrow(arrow, positions, playhead)).join("");
  const players = timeline.actors.map((actor) => boardPiece({ ...actor, ...(positions[actor.id] || { x: 50, y: 50 }) })).join("");
  const ball = boardBall(lesson, playhead, positions);
  const trails = timeline.actors.map((actor) => boardTrail(actor, timeline.tracks?.[actor.id])).join("");
  return `
    <div class="half-court">
      <div class="court-paint"></div>
      <div class="court-rim"></div>
      <div class="court-arc"></div>
      ${zones}
      ${trails}
      ${arrows}
      ${players}
      ${ball}
    </div>`;
}

function renderStaticTacticBoard(frame) {
  const players = [
    ...(frame.offense || []).map((p) => boardPiece({ ...p, side: "offense" })),
    ...(frame.defense || []).map((p) => boardPiece({ ...p, side: "defense" })),
  ].join("");
  const arrows = (frame.arrows || []).map((arrow) => boardArrow({ ...arrow, type: "pass" })).join("");
  return `
    <div class="half-court">
      <div class="court-paint"></div>
      <div class="court-rim"></div>
      <div class="court-arc"></div>
      ${arrows}
      ${players}
    </div>`;
}

function actorPositions(lesson, playhead) {
  const tracks = lesson.timeline?.tracks || {};
  return Object.fromEntries(Object.entries(tracks).map(([id, track]) => [id, interpolateTrack(track, playhead)]));
}

function interpolateTrack(track, playhead) {
  if (!Array.isArray(track) || !track.length) return { x: 50, y: 50 };
  const points = track.slice().sort((a, b) => a.t - b.t);
  if (playhead <= points[0].t) return { x: points[0].x, y: points[0].y };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (playhead >= a.t && playhead <= b.t) {
      const k = (playhead - a.t) / Math.max(1, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

function boardPiece(piece) {
  const primaryClass = piece.primary ? "primary" : "context";
  return `<span class="board-piece ${piece.side || ""} ${primaryClass}" data-ai-actor-id="${piece.id || ""}" data-ai-side="${piece.side || ""}" data-ai-role="${piece.role || ""}" data-ai-primary="${piece.primary ? "true" : "false"}" data-ai-x="${roundBoardValue(piece.x)}" data-ai-y="${roundBoardValue(piece.y)}" style="left:${piece.x}%;top:${piece.y}%"><b>${piece.label}</b><em>${piece.role || ""}</em></span>`;
}

function boardBall(lesson, playhead, positions) {
  const events = lesson.timeline?.ball || [];
  if (!events.length) return "";
  let current = events[0], next = null;
  for (let i = 0; i < events.length; i++) {
    if ((events[i].t || 0) <= playhead) {
      current = events[i];
      next = events[i + 1] || null;
    }
  }
  const from = current.holder ? (positions[current.holder] || { x: 50, y: 50 }) : { x: current.x || 50, y: current.y || 50 };
  let pos = from;
  const passWindow = next ? Math.min(520, Math.max(220, next.t - current.t)) : 0;
  if (next && playhead >= next.t - passWindow) {
    const to = next.holder ? (positions[next.holder] || from) : { x: next.x || from.x, y: next.y || from.y };
    const k = (playhead - (next.t - passWindow)) / Math.max(1, passWindow);
    pos = { x: from.x + (to.x - from.x) * clamp(k, 0, 1), y: from.y + (to.y - from.y) * clamp(k, 0, 1) };
  }
  return `<span class="board-ball" data-ai-ball="true" data-ai-holder="${current.holder || ""}" data-ai-label="${current.label || ""}" data-ai-x="${roundBoardValue(pos.x)}" data-ai-y="${roundBoardValue(pos.y)}" style="left:${pos.x}%;top:${pos.y}%"></span>`;
}

function tacticZone(zone) {
  return `<span class="board-zone ${zone.type || ""}" data-ai-zone-type="${zone.type || ""}" style="left:${zone.x}%;top:${zone.y}%;width:${zone.w}%;height:${zone.h}%"><b>${zone.label || ""}</b></span>`;
}

function boardArrow(arrow, positions = null, playhead = 0) {
  const start = boardPoint(arrow.from, positions);
  const end = boardPoint(arrow.to, positions);
  const x1 = start.x, y1 = start.y;
  const x2 = end.x, y2 = end.y;
  const dx = x2 - x1, dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const window = Math.max(1, (arrow.tEnd || playhead + 1) - (arrow.tStart || playhead));
  const progress = positions ? clamp((playhead - arrow.tStart) / window, 0.25, 1) : 1;
  return `<i class="board-arrow ${arrow.type || ""}" data-ai-arrow-type="${arrow.type || ""}" data-ai-x1="${roundBoardValue(x1)}" data-ai-y1="${roundBoardValue(y1)}" data-ai-x2="${roundBoardValue(x2)}" data-ai-y2="${roundBoardValue(y2)}" style="left:${x1}%;top:${y1}%;width:${length * progress}%;transform:rotate(${angle}deg)"><span>${arrow.label || ""}</span></i>`;
}

function boardTrail(actor, track) {
  if (!Array.isArray(track) || track.length < 2) return "";
  const points = track.slice().sort((a, b) => a.t - b.t).map((point) => `${roundBoardValue(point.x)},${roundBoardValue(point.y)}`).join(" ");
  return `<svg class="board-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline class="${actor.side || ""} ${actor.primary ? "primary" : "context"}" points="${points}" data-ai-trail-actor="${actor.id || ""}" data-ai-primary="${actor.primary ? "true" : "false"}" /></svg>`;
}

function boardAction(action, lesson, positions, playhead) {
  const points = boardActionPoints(action, lesson, positions, playhead);
  const x1 = points.start.x, y1 = points.start.y;
  const x2 = points.end.x, y2 = points.end.y;
  const dx = x2 - x1, dy = y2 - y1;
  const length = Math.max(3, Math.sqrt(dx * dx + dy * dy));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const window = Math.max(1, (action.tEnd || playhead + 1) - (action.tStart || playhead));
  const progress = clamp((playhead - action.tStart) / window, 0.2, 1);
  return `<i class="board-action ${action.type || ""} ${action.side || ""}" data-ai-action-id="${action.id || ""}" data-ai-action-type="${action.type || ""}" data-ai-action-side="${action.side || ""}" data-ai-cause-tag="${action.causeTag || ""}" data-ai-risk-tag="${action.riskTag || ""}" data-ai-x1="${roundBoardValue(x1)}" data-ai-y1="${roundBoardValue(y1)}" data-ai-x2="${roundBoardValue(x2)}" data-ai-y2="${roundBoardValue(y2)}" style="left:${x1}%;top:${y1}%;width:${length * progress}%;transform:rotate(${angle}deg)"><span>${tacticActionLabel(action.type)}</span></i>`;
}

function boardActionPoints(action, lesson, positions, playhead) {
  let start = boardPoint(action.from, positions);
  let end = boardPoint(action.to, positions);
  const needsTrackVector = typeof action.from === "string" && action.from === action.to;
  const trackId = needsTrackVector ? action.from : "";
  if (trackId && lesson.timeline?.tracks?.[trackId]) {
    start = interpolateTrack(lesson.timeline.tracks[trackId], action.tStart || 0);
    end = interpolateTrack(lesson.timeline.tracks[trackId], clamp(playhead, action.tStart || 0, action.tEnd || playhead));
  }
  const dx = end.x - start.x, dy = end.y - start.y;
  if (Math.sqrt(dx * dx + dy * dy) < 1) {
    end = { x: start.x + (action.side === "defense" ? -5 : 5), y: start.y + (action.type === "screen" ? -4 : 3) };
  }
  return { start, end };
}

function boardPoint(ref, positions = null) {
  if (Array.isArray(ref)) return { x: Number(ref[0]) || 0, y: Number(ref[1]) || 0 };
  if (positions && ref && positions[ref]) return positions[ref];
  return { x: 50, y: 50 };
}

function roundBoardValue(value) {
  return String(Math.round((Number(value) || 0) * 10) / 10);
}

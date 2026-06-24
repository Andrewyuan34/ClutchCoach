import { TACTIC_LESSONS } from "../data/tactical-data.mjs?v=action-motion-33";
import { S } from "../state.mjs?v=action-motion-33";
import { clone, isVisible, parsePercent } from "./dom-utils.mjs?v=action-motion-33";

export function tacticLessonSignals() {
  const modal = document.getElementById("tactic-lesson-modal");
  const visible = isVisible(modal) && !modal?.classList.contains("hidden");
  const openedLessonId = S.tacticLesson?.lessonId || (visible ? (modal?.dataset.aiLessonId || "") : "");
  const current = openedLessonId ? TACTIC_LESSONS[openedLessonId] : null;
  const frameIndex = Number(modal?.dataset.aiFrameIndex || S.tacticLesson?.frameIndex || 0);
  const movingActorCount = (lesson) => Object.values(lessonTimeline(lesson)?.tracks || {}).filter((track) => {
    if (!Array.isArray(track) || track.length < 2) return false;
    const first = track[0];
    return track.some((point) => Math.abs((point.x || 0) - (first.x || 0)) > 0.5 || Math.abs((point.y || 0) - (first.y || 0)) > 0.5);
  }).length;
  const sideCountsFor = (actors = []) => actors.reduce((counts, actor) => {
    counts[actor.side] = (counts[actor.side] || 0) + 1;
    return counts;
  }, { offense: 0, defense: 0 });
  const actorTravel = (lesson, actor) => trackTravel(lessonTimeline(lesson)?.tracks?.[actor.id]);
  const movingByPrimary = (lesson, primary) => (lessonTimeline(lesson)?.actors || [])
    .filter((actor) => !!actor.primary === primary)
    .filter((actor) => actorTravel(lesson, actor) > 0.5)
    .length;
  const lessons = Object.values(TACTIC_LESSONS).map((lesson) => ({
    lessonId: lesson.lessonId,
    kind: lesson.kind,
    key: lesson.key,
    title: lesson.title,
    intent: lesson.intent,
    needs: clone(lesson.needs || []),
    risks: clone(lesson.risks || []),
    watchFor: clone(lesson.watchFor || []),
    frameCount: beatCount(lesson),
    timeline: {
      system: lessonTimeline(lesson)?.system || "",
      pureAnimation: !!lessonTimeline(lesson)?.pureAnimation,
      personnel: Number(lessonTimeline(lesson)?.personnel || 0),
      primaryPersonnel: Number(lessonTimeline(lesson)?.primaryPersonnel || 0),
      primarySide: lessonTimeline(lesson)?.primarySide || "",
      subject: lessonTimeline(lesson)?.subject || "",
      durationMs: lessonTimeline(lesson)?.durationMs || 0,
      actorCount: lessonTimeline(lesson)?.actors?.length || 0,
      trackedActorCount: Object.keys(lessonTimeline(lesson)?.tracks || {}).length,
      sideCounts: sideCountsFor(lessonTimeline(lesson)?.actors || []),
      primaryActorCount: (lessonTimeline(lesson)?.actors || []).filter((actor) => !!actor.primary).length,
      contextActorCount: (lessonTimeline(lesson)?.actors || []).filter((actor) => !actor.primary).length,
      movingActorCount: movingActorCount(lesson),
      primaryMovingActorCount: movingByPrimary(lesson, true),
      contextMovingActorCount: movingByPrimary(lesson, false),
      maxActorTravel: timelineMaxActorTravel(lesson),
      ballTransfers: Math.max(0, (lessonTimeline(lesson)?.ball?.length || 1) - 1),
      arrowCount: lessonTimeline(lesson)?.arrows?.length || 0,
      actionCount: lessonTimeline(lesson)?.actions?.length || 0,
      actionTypes: actionTypesFor(lesson),
      beatPhases: [...new Set((lessonTimeline(lesson)?.beats || []).map((beat) => beat.phase).filter(Boolean))],
      beatsWithActions: (lessonTimeline(lesson)?.beats || []).filter((beat) => (beat.actionIds || []).length > 0).length,
      causeTags: actionTagsFor(lesson, "causeTag"),
      riskTags: actionTagsFor(lesson, "riskTag"),
      costPath: clone(lessonTimeline(lesson)?.costPath || []),
    },
  }));
  const board = boardLessonDomSignals(modal);
  return {
    available: lessons.map((lesson) => lesson.lessonId),
    openedLessonId,
    visible,
    watched: clone(S.learnedTactics || {}),
    currentLesson: current ? {
      id: current.lessonId,
      system: modal?.dataset.aiSystem || current.timeline?.system || "",
      title: current.title,
      frameIndex,
      frameCount: beatCount(current),
      frameLabel: current.timeline?.beats?.[frameIndex]?.label || current.frames?.[frameIndex]?.label || "",
      beatPhase: modal?.dataset.aiBeatPhase || activeBeatFor(current, Number(modal?.dataset.aiPlayheadMs || S.tacticLesson?.playheadMs || 0)).phase || "",
      playheadMs: Number(modal?.dataset.aiPlayheadMs || S.tacticLesson?.playheadMs || 0),
      durationMs: Number(modal?.dataset.aiDurationMs || current.timeline?.durationMs || 0),
      actorCount: Number(modal?.dataset.aiTimelineActors || current.timeline?.actors?.length || 0),
      pureAnimation: modal?.dataset.aiPureAnimation === "true" || !!current.timeline?.pureAnimation,
      personnel: Number(modal?.dataset.aiPersonnel || current.timeline?.personnel || 0),
      primaryPersonnel: Number(modal?.dataset.aiPrimaryPersonnel || current.timeline?.primaryPersonnel || 0),
      primarySide: modal?.dataset.aiPrimarySide || current.timeline?.primarySide || "",
      subject: modal?.dataset.aiSubject || current.timeline?.subject || "",
      movingActorCount: Number(modal?.dataset.aiMovingActors || movingActorCount(current)),
      ballTransfers: Number(modal?.dataset.aiBallTransfers || Math.max(0, (current.timeline?.ball?.length || 1) - 1)),
      actionCount: Number(modal?.dataset.aiActionCount || current.timeline?.actions?.length || 0),
      activeActions: clone((modal?.dataset.aiActiveActions || activeActionsFor(current, Number(modal?.dataset.aiPlayheadMs || S.tacticLesson?.playheadMs || 0)).map((action) => action.id).join(" ")).split(/\s+/).filter(Boolean)),
      actionTypes: clone((modal?.dataset.aiActionTypes || actionTypesFor(current).join(" ")).split(/\s+/).filter(Boolean)),
      causeTags: clone((modal?.dataset.aiCauseTags || actionTagsFor(current, "causeTag").join(" ")).split(/\s+/).filter(Boolean)),
      riskTags: clone((modal?.dataset.aiRiskTags || actionTagsFor(current, "riskTag").join(" ")).split(/\s+/).filter(Boolean)),
      costPath: clone((modal?.dataset.aiCostPath || "").split(/\s+/).filter(Boolean)),
      board,
      motionProbe: sampleTacticLessonMotion(current.lessonId, [0, Math.floor((current.timeline?.durationMs || 1) / 2), current.timeline?.durationMs || 0]),
      needs: clone(current.needs || []),
      risks: clone(current.risks || []),
      watchFor: clone(current.watchFor || []),
    } : null,
    lessons,
  };
}

function boardLessonDomSignals(modal) {
  const board = document.getElementById("tactic-lesson-board");
  const scrubber = document.getElementById("tactic-lesson-scrubber");
  const actorEls = [...(board?.querySelectorAll(".board-piece[data-ai-actor-id]") || [])];
  const ballEl = board?.querySelector("[data-ai-ball='true']");
  return {
    system: board?.dataset.aiSystem || "",
    playheadMs: Number(board?.dataset.aiPlayheadMs || 0),
    durationMs: Number(board?.dataset.aiDurationMs || 0),
    actorCount: actorEls.length,
    personnel: Number(board?.dataset.aiPersonnel || 0),
    primaryPersonnel: Number(board?.dataset.aiPrimaryPersonnel || 0),
    primarySide: board?.dataset.aiPrimarySide || "",
    pureAnimation: board?.dataset.aiPureAnimation === "true",
    sideCounts: {
      offense: Number(board?.dataset.aiOffenseCount || actorEls.filter((el) => el.dataset.aiSide === "offense").length || 0),
      defense: Number(board?.dataset.aiDefenseCount || actorEls.filter((el) => el.dataset.aiSide === "defense").length || 0),
    },
    primaryActorCount: Number(board?.dataset.aiPrimaryActorCount || actorEls.filter((el) => el.dataset.aiPrimary === "true").length || 0),
    contextActorCount: Number(board?.dataset.aiContextActorCount || actorEls.filter((el) => el.dataset.aiPrimary === "false").length || 0),
    activeArrows: Number(board?.dataset.aiActiveArrows || board?.querySelectorAll(".board-arrow").length || 0),
    actionCount: Number(board?.dataset.aiActionCount || 0),
    activeActions: clone((board?.dataset.aiActiveActions || "").split(/\s+/).filter(Boolean)),
    activeActionTypes: clone((board?.dataset.aiActiveActionTypes || "").split(/\s+/).filter(Boolean)),
    beatPhase: board?.dataset.aiBeatPhase || "",
    causeTags: clone((board?.dataset.aiCauseTags || "").split(/\s+/).filter(Boolean)),
    riskTags: clone((board?.dataset.aiRiskTags || "").split(/\s+/).filter(Boolean)),
    activeZones: Number(board?.dataset.aiActiveZones || board?.querySelectorAll(".board-zone").length || 0),
    ballPresent: !!ballEl,
    scrubberValue: Number(scrubber?.value || 0),
    scrubberMax: Number(scrubber?.max || 0),
    actors: actorEls.map((el) => ({
      id: el.dataset.aiActorId || "",
      side: el.dataset.aiSide || "",
      role: el.dataset.aiRole || "",
      primary: el.dataset.aiPrimary === "true",
      x: Number(el.dataset.aiX || parsePercent(el.style.left)),
      y: Number(el.dataset.aiY || parsePercent(el.style.top)),
    })),
    ball: ballEl ? {
      holder: ballEl.dataset.aiHolder || "",
      label: ballEl.dataset.aiLabel || "",
      x: Number(ballEl.dataset.aiX || parsePercent(ballEl.style.left)),
      y: Number(ballEl.dataset.aiY || parsePercent(ballEl.style.top)),
    } : null,
    modalVisible: isVisible(modal) && !modal?.classList.contains("hidden"),
  };
}

function lessonTimeline(lesson) {
  return lesson?.timeline || null;
}

function beatCount(lesson) {
  return lessonTimeline(lesson)?.beats?.length || lesson?.frames?.length || 0;
}

function actionTypesFor(lesson) {
  return [...new Set((lessonTimeline(lesson)?.actions || []).map((action) => action.type).filter(Boolean))];
}

function actionTagsFor(lesson, key) {
  return [...new Set((lessonTimeline(lesson)?.actions || []).map((action) => action[key]).filter(Boolean))];
}

function activeActionsFor(lesson, playhead) {
  return (lessonTimeline(lesson)?.actions || []).filter((action) => playhead >= action.tStart && playhead <= action.tEnd);
}

function activeBeatFor(lesson, playhead) {
  const beats = lessonTimeline(lesson)?.beats || [];
  let active = beats[0] || {};
  beats.forEach((beat) => {
    if ((beat.t || 0) <= playhead + 10) active = beat;
  });
  return active;
}

export function sampleTacticLessonMotion(lessonId, sampleMs = null) {
  const lesson = TACTIC_LESSONS[lessonId];
  const timeline = lesson?.timeline;
  if (!timeline) return null;
  const duration = Number(timeline.durationMs || 0);
  const samples = Array.isArray(sampleMs) && sampleMs.length ? sampleMs : [0, Math.floor(duration / 2), duration];
  const normalized = samples.map((ms) => Math.max(0, Math.min(duration, Number(ms) || 0)));
  const frames = normalized.map((ms) => ({
    ms,
    actors: Object.fromEntries((timeline.actors || []).map((actor) => [actor.id, sampleTrack(timeline.tracks?.[actor.id], ms)])),
    ball: sampleBall(timeline, ms),
    ballHolder: activeBallHolder(timeline, ms),
    activeActions: activeActionsFor(lesson, ms).map((action) => ({ id: action.id, type: action.type, side: action.side, causeTag: action.causeTag, riskTag: action.riskTag })),
    beatPhase: activeBeatFor(lesson, ms).phase || "",
  }));
  const primaryActors = (timeline.actors || []).filter((actor) => !!actor.primary).map((actor) => actor.id);
  const contextActors = (timeline.actors || []).filter((actor) => !actor.primary).map((actor) => actor.id);
  const sideCounts = (timeline.actors || []).reduce((counts, actor) => {
    counts[actor.side] = (counts[actor.side] || 0) + 1;
    return counts;
  }, { offense: 0, defense: 0 });
  return {
    lessonId,
    system: timeline.system || "",
    pureAnimation: !!timeline.pureAnimation,
    durationMs: duration,
    primarySide: timeline.primarySide || "",
    sideCounts,
    primaryActors,
    contextActors,
    actionCount: (timeline.actions || []).length,
    actionTypes: actionTypesFor(lesson),
    causeTags: actionTagsFor(lesson, "causeTag"),
    riskTags: actionTagsFor(lesson, "riskTag"),
    sampleMs: normalized,
    maxActorTravel: timelineMaxActorTravel(lesson),
    ballHolders: [...new Set(frames.map((frame) => frame.ballHolder).filter(Boolean))],
    frames,
  };
}

function timelineMaxActorTravel(lesson) {
  const tracks = lesson?.timeline?.tracks || {};
  let max = 0;
  Object.values(tracks).forEach((track) => {
    max = Math.max(max, trackTravel(track));
  });
  return Math.round(max * 10) / 10;
}

function trackTravel(track) {
  if (!Array.isArray(track) || track.length < 2) return 0;
  const first = track[0];
  let max = 0;
  track.forEach((point) => {
    const dx = (Number(point.x) || 0) - (Number(first.x) || 0);
    const dy = (Number(point.y) || 0) - (Number(first.y) || 0);
    max = Math.max(max, Math.sqrt(dx * dx + dy * dy));
  });
  return max;
}

function sampleTrack(track, playhead) {
  if (!Array.isArray(track) || !track.length) return { x: 50, y: 50 };
  const points = track.slice().sort((a, b) => a.t - b.t);
  if (playhead <= points[0].t) return { x: points[0].x, y: points[0].y };
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i], b = points[i + 1];
    if (playhead >= a.t && playhead <= b.t) {
      const k = (playhead - a.t) / Math.max(1, b.t - a.t);
      return {
        x: Math.round((a.x + (b.x - a.x) * k) * 10) / 10,
        y: Math.round((a.y + (b.y - a.y) * k) * 10) / 10,
      };
    }
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

function activeBallHolder(timeline, playhead) {
  let holder = "";
  (timeline.ball || []).forEach((event) => {
    if (event.t <= playhead) holder = event.holder || holder;
  });
  return holder;
}

function sampleBall(timeline, playhead) {
  const events = timeline.ball || [];
  if (!events.length) return null;
  let current = events[0], next = null;
  for (let i = 0; i < events.length; i += 1) {
    if ((events[i].t || 0) <= playhead) {
      current = events[i];
      next = events[i + 1] || null;
    }
  }
  const positions = Object.fromEntries((timeline.actors || []).map((actor) => [actor.id, sampleTrack(timeline.tracks?.[actor.id], playhead)]));
  const from = current.holder ? (positions[current.holder] || { x: 50, y: 50 }) : { x: current.x || 50, y: current.y || 50 };
  let pos = from;
  const passWindow = next ? Math.min(520, Math.max(220, next.t - current.t)) : 0;
  if (next && playhead >= next.t - passWindow) {
    const to = next.holder ? (positions[next.holder] || from) : { x: next.x || from.x, y: next.y || from.y };
    const k = (playhead - (next.t - passWindow)) / Math.max(1, passWindow);
    pos = {
      x: Math.round((from.x + (to.x - from.x) * Math.max(0, Math.min(1, k))) * 10) / 10,
      y: Math.round((from.y + (to.y - from.y) * Math.max(0, Math.min(1, k))) * 10) / 10,
    };
  }
  return { holder: current.holder || "", label: current.label || "", x: pos.x, y: pos.y };
}

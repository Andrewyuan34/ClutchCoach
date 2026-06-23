import { S } from "../state.mjs?v=action-motion-33";
import { clone, isVisible } from "./dom-utils.mjs?v=action-motion-33";

export function postgameRecapSignals() {
  const wrap = document.getElementById("post-coach-recap");
  const itemEls = [...document.querySelectorAll("#post-coach-recap .post-recap-item")];
  const lessonLinks = [...document.querySelectorAll("#post-coach-recap .post-recap-lesson")]
    .map((btn) => btn.dataset.lessonId || "")
    .filter(Boolean);
  const stateItems = clone(S.postgameRecap || []);
  const items = itemEls.map((el) => {
    const id = el.dataset.aiCommandSessionId || "";
    const stateItem = stateItems.find((item) => item.id === id) || {};
    return {
      id,
      coachActionId: el.dataset.aiCoachActionId || stateItem.coachActionId || "",
      adjustmentId: el.dataset.aiAdjustmentId || stateItem.adjustmentId || "",
      adoptedAdviceId: el.dataset.aiAdoptedAdviceId || stateItem.adoptedAdviceId || "",
      acceptedCost: el.dataset.aiAcceptedCost || stateItem.acceptedCost || "",
      lessonId: el.dataset.aiLessonId || stateItem.lessonId || "",
      result: el.dataset.aiResult || stateItem.result || "",
      summaryLivecastId: stateItem.summaryLivecastId || "",
      sourceLivecastIds: clone(stateItem.sourceLivecastIds || []),
      sourceContextIds: clone(stateItem.sourceContextIds || []),
      feedbackLivecastIds: clone(stateItem.feedbackLivecastIds || []),
      text: (el.innerText || "").trim(),
    };
  });
  return {
    visible: isVisible(wrap) && !wrap?.classList.contains("hidden"),
    count: itemEls.length,
    stateItems,
    items,
    lessonLinks,
  };
}


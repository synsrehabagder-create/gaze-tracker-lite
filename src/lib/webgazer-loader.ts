import webgazer from "webgazer";

let initialized = false;
let initPromise: Promise<boolean> | null = null;

function hideWebGazerUI() {
  const ids = [
    "webgazerVideoFeed",
    "webgazerVideoContainer",
    "webgazerFaceOverlay",
    "webgazerFaceFeedbackBox",
    "webgazerGazeDot",
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

export async function initWebGazer() {
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      webgazer.params.faceMeshSolutionPath = "/mediapipe/face_mesh";

      webgazer
        .setTracker("TFFacemesh")
        .setRegression("ridge")
        .saveDataAcrossSessions(false)
        .showPredictionPoints(false)
        .setGazeListener(() => {});

      await webgazer.begin();
      hideWebGazerUI();
      initialized = true;
      return true;
    } catch (error) {
      console.error("WebGazer init failed:", error);
      initialized = false;
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

export function isWebGazerReady() {
  return initialized;
}

export function getWebGazer() {
  return webgazer;
}

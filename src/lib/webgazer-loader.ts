import webgazer from "webgazer";

let initialized = false;
let initPromise: Promise<boolean> | null = null;
let lastInitError: string | null = null;

const CDN_FALLBACK_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh";

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

function getLocalFaceMeshSolutionPath() {
  const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${baseUrl}mediapipe/face_mesh`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Ukjent feil";
  }
}

function configureWebGazer(faceMeshSolutionPath: string) {
  webgazer.params.faceMeshSolutionPath = faceMeshSolutionPath;
  // Compatibility with older/newer internal path keys.
  (webgazer.params as Record<string, unknown>).faceMeshPath = faceMeshSolutionPath;

  webgazer
    .setTracker("TFFacemesh")
    .setRegression("ridge")
    .saveDataAcrossSessions(false)
    .showPredictionPoints(false)
    .setGazeListener(() => {});
}

async function tryBeginWithPath(faceMeshSolutionPath: string): Promise<boolean> {
  try {
    try {
      webgazer.end();
    } catch {
      // ignore stale state
    }

    configureWebGazer(faceMeshSolutionPath);
    await webgazer.begin();
    hideWebGazerUI();
    initialized = true;
    lastInitError = null;
    return true;
  } catch (error) {
    initialized = false;
    lastInitError = getErrorMessage(error);

    try {
      webgazer.end();
    } catch {
      // ignore cleanup error
    }

    return false;
  }
}

export async function initWebGazer(): Promise<boolean> {
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      lastInitError = "Nettleseren støtter ikke kamera-API";
      return false;
    }

    const paths = [getLocalFaceMeshSolutionPath(), CDN_FALLBACK_PATH];

    for (const path of paths) {
      const ok = await tryBeginWithPath(path);
      if (ok) return true;
    }

    console.error("WebGazer init failed:", lastInitError);
    return false;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function stopWebGazer() {
  try {
    webgazer.setGazeListener(() => {});
    webgazer.end();
  } catch {
    // no-op
  } finally {
    initialized = false;
  }
}

export function isWebGazerReady() {
  return initialized;
}

export function getWebGazer() {
  return webgazer;
}

export function getWebGazerInitError() {
  return lastInitError;
}

export function resetWebGazerState() {
  initialized = false;
  initPromise = null;
  lastInitError = null;
}

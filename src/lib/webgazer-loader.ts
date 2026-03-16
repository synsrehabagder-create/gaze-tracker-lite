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

function getFaceMeshSolutionPath() {
  const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${baseUrl}mediapipe/face_mesh`;
}

/**
 * Request camera permission explicitly before WebGazer tries.
 * Some devices fail with strict constraints, so we try a fallback too.
 */
async function ensureCameraAccess(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.warn("getUserMedia is not supported in this browser");
    return false;
  }

  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } },
    { video: true },
  ];

  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      console.warn("Camera probe attempt failed:", err);
    }
  }

  return false;
}

function configureWebGazer() {
  const faceMeshSolutionPath = getFaceMeshSolutionPath();

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

export async function initWebGazer(): Promise<boolean> {
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const hasCameraAccess = await ensureCameraAccess();
      if (!hasCameraAccess) {
        console.warn("No camera stream available — tracking will be skipped");
        return false;
      }

      // Ensure stale instance from previous attempt is fully stopped.
      try {
        webgazer.end();
      } catch {
        // ignore
      }

      configureWebGazer();
      await webgazer.begin();
      hideWebGazerUI();
      initialized = true;
      return true;
    } catch (error) {
      console.error("WebGazer init failed:", error);
      initialized = false;

      try {
        webgazer.end();
      } catch {
        // ignore
      }

      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
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

export function resetWebGazerState() {
  initialized = false;
  initPromise = null;
}

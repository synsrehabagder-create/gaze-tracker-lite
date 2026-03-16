import webgazer from "webgazer";

let initialized = false;
let initPromise: Promise<boolean> | null = null;
let initFailed = false;

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

/**
 * Request camera permission explicitly before WebGazer tries.
 * This gives a clearer error if denied/unavailable.
 */
async function ensureCameraAccess(): Promise<MediaStream | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    return stream;
  } catch (err) {
    console.warn("Camera access denied or unavailable:", err);
    return null;
  }
}

export async function initWebGazer(): Promise<boolean> {
  // If WASM already crashed, don't retry (it corrupts the module)
  if (initFailed) {
    console.warn("WebGazer previously failed to init, skipping retry");
    return false;
  }

  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Pre-check camera access
      const stream = await ensureCameraAccess();
      if (!stream) {
        console.warn("No camera stream available — tracking will be skipped");
        return false;
      }
      // Stop the pre-check stream; WebGazer will open its own
      stream.getTracks().forEach((t) => t.stop());

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
      initFailed = true; // prevent re-init of broken WASM
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
    // Don't reset initFailed — WASM stays broken once it crashes
  }
}

export function isWebGazerReady() {
  return initialized;
}

export function getWebGazer() {
  return webgazer;
}

/** Reset the failure flag (e.g. on full page reload) */
export function resetWebGazerState() {
  initialized = false;
  initFailed = false;
  initPromise = null;
}

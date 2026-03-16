import webgazer from "webgazer";

let initialized = false;
let initPromise: Promise<boolean> | null = null;
let lastInitError: string | null = null;

const CDN_FALLBACK_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh";
const CAMERA_CONSTRAINT_FALLBACKS: MediaStreamConstraints[] = [
  { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } },
  { video: { facingMode: "user" } },
  { video: true },
];

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

function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

function cleanupWebGazerVideoFeed() {
  const videoFeed = document.getElementById("webgazerVideoFeed") as HTMLVideoElement | null;
  if (!videoFeed || !(videoFeed.srcObject instanceof MediaStream)) return;

  stopStream(videoFeed.srcObject);
  videoFeed.srcObject = null;
}

function endWebGazerSession() {
  try {
    webgazer.setGazeListener(() => {});
  } catch {
    // ignore listener cleanup error
  }

  try {
    webgazer.end();
  } catch {
    // ignore stale state
  }

  cleanupWebGazerVideoFeed();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLocalFaceMeshSolutionPath() {
  const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${baseUrl}mediapipe/face_mesh`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof DOMException) return `${error.name}: ${error.message}`;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Ukjent feil";
  }
}

async function probeCameraAccess() {
  const errorMessages: string[] = [];

  for (const constraints of CAMERA_CONSTRAINT_FALLBACKS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stopStream(stream);
      return true;
    } catch (error) {
      errorMessages.push(getErrorMessage(error));
    }
  }

  lastInitError = errorMessages[errorMessages.length - 1] ?? "Kunne ikke åpne kamera";
  return false;
}

function configureWebGazer(faceMeshSolutionPath: string, constraints: MediaStreamConstraints) {
  webgazer.params.faceMeshSolutionPath = faceMeshSolutionPath;
  // Compatibility with older/newer internal path keys.
  (webgazer.params as Record<string, unknown>).faceMeshPath = faceMeshSolutionPath;
  (webgazer.params as { camConstraints?: MediaStreamConstraints }).camConstraints = constraints;

  webgazer
    .setTracker("TFFacemesh")
    .setRegression("ridge")
    .saveDataAcrossSessions(false)
    .showPredictionPoints(false)
    .setGazeListener(() => {});
}

async function tryBegin(faceMeshSolutionPath: string, constraints: MediaStreamConstraints): Promise<boolean> {
  try {
    endWebGazerSession();
    await wait(120);

    console.log("[webgazer] Trying:", { faceMeshSolutionPath, constraints });
    configureWebGazer(faceMeshSolutionPath, constraints);
    await webgazer.begin();
    hideWebGazerUI();

    initialized = true;
    lastInitError = null;

    // Diagnostic: verify tracker is accessible
    try {
      const tracker = webgazer.getTracker();
      console.log("[webgazer] Initialized OK.", {
        hasTracker: !!tracker,
        trackerType: tracker?.constructor?.name,
        hasGetPositions: typeof tracker?.getPositions === "function",
      });
    } catch {
      console.warn("[webgazer] Tracker not accessible after begin()");
    }

    return true;
  } catch (error) {
    initialized = false;
    lastInitError = getErrorMessage(error);
    console.warn("[webgazer] tryBegin failed:", lastInitError);
    endWebGazerSession();
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

    const hasCameraAccess = await probeCameraAccess();
    if (!hasCameraAccess) return false;

    const paths = [getLocalFaceMeshSolutionPath(), CDN_FALLBACK_PATH];
    const attempts: string[] = [];

    for (const path of paths) {
      for (const constraints of CAMERA_CONSTRAINT_FALLBACKS) {
        const ok = await tryBegin(path, constraints);
        if (ok) return true;

        attempts.push(`${path} :: ${JSON.stringify(constraints)}`);
      }
    }

    console.error("WebGazer init failed:", { lastInitError, attempts });
    return false;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function stopWebGazer() {
  endWebGazerSession();
  initialized = false;
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

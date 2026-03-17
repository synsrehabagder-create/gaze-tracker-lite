import * as faceMeshModule from "@mediapipe/face_mesh";
const FaceMeshClass = (faceMeshModule as any).FaceMesh || (faceMeshModule as any).default?.FaceMesh;

export type FrameCallback = (
  landmarks: number[][],
  videoSize: { width: number; height: number }
) => void;

const LOCAL_WASM_BASE = `${import.meta.env.BASE_URL || "/"}mediapipe/face_mesh/`.replace(
  /\/\//g,
  "/"
);
const CDN_FALLBACK = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619";

const CAMERA_FALLBACKS: MediaStreamConstraints[] = [
  { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } },
  { video: { facingMode: "user" } },
  { video: true },
];

let faceMesh: any = null;
let video: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;
let animFrameId: number | null = null;
let initialized = false;
let initPromise: Promise<boolean> | null = null;
let lastError: string | null = null;
let frameCallback: FrameCallback | null = null;
let detecting = false;

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException) return `${error.name}: ${error.message}`;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Ukjent feil";
}

function createHiddenVideo(): HTMLVideoElement {
  const el = document.createElement("video");
  el.setAttribute("autoplay", "");
  el.setAttribute("playsinline", "");
  el.setAttribute("muted", "");
  el.muted = true;
  el.style.position = "fixed";
  el.style.opacity = "0";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  return el;
}

async function acquireCamera(): Promise<MediaStream> {
  const errors: string[] = [];
  for (const constraints of CAMERA_FALLBACKS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      errors.push(getErrorMessage(e));
    }
  }
  throw new Error(errors[errors.length - 1] ?? "Kunne ikke åpne kamera");
}

async function createFaceMesh(basePath: string): Promise<any> {
  const fm = new FaceMeshClass({
    locateFile: (file: string) => `${basePath}/${file}`,
  });
  fm.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  await fm.initialize();
  return fm;
}

function processLoop() {
  if (!detecting || !video || !faceMesh) return;
  if (video.readyState >= 2) {
    faceMesh.send({ image: video }).catch(() => {});
  }
  animFrameId = requestAnimationFrame(processLoop);
}

export async function initDetector(): Promise<boolean> {
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        lastError = "Nettleseren støtter ikke kamera-API";
        return false;
      }

      stream = await acquireCamera();
      video = createHiddenVideo();
      video.srcObject = stream;
      await video.play();

      let fm: any = null;
      try {
        fm = await createFaceMesh(LOCAL_WASM_BASE);
      } catch (localErr) {
        console.warn("[face-detector] Local WASM failed, trying CDN:", getErrorMessage(localErr));
        try {
          fm = await createFaceMesh(CDN_FALLBACK);
        } catch (cdnErr) {
          lastError = getErrorMessage(cdnErr);
          console.error("[face-detector] CDN fallback also failed:", lastError);
          return false;
        }
      }

      faceMesh = fm;

      faceMesh.onResults((results) => {
        if (!frameCallback || !video) return;
        const faces = results.multiFaceLandmarks;
        if (!faces || faces.length === 0) return;

        const landmarks = faces[0];
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        const pixelLandmarks: number[][] = landmarks.map((p) => [p.x * w, p.y * h, p.z]);
        frameCallback(pixelLandmarks, { width: w, height: h });
      });

      initialized = true;
      lastError = null;
      console.log("[face-detector] Initialized OK.", {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
      return true;
    } catch (e) {
      lastError = getErrorMessage(e);
      console.error("[face-detector] Init failed:", lastError);
      return false;
    }
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function startDetection(callback: FrameCallback) {
  frameCallback = callback;
  detecting = true;
  animFrameId = requestAnimationFrame(processLoop);
}

export function stopDetection() {
  detecting = false;
  frameCallback = null;
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

export function stopDetector() {
  stopDetection();
  if (faceMesh) { faceMesh.close().catch(() => {}); faceMesh = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (video) { video.srcObject = null; video.remove(); video = null; }
  initialized = false;
}

export function isDetectorReady(): boolean { return initialized; }
export function getDetectorError(): string | null { return lastError; }

import { FrameFeatures, extractFrameFeatures } from "./frame-analyzer";
import { ClinicalReport, buildClinicalReport } from "./session-analyzer";
import { startDetection, stopDetection } from "./face-detector";

let frames: FrameFeatures[] = [];
let tracking = false;
let sessionTaskType: "reading" | "pursuit" = "reading";
let sessionId = "";
let taskBounds: { x: number; y: number; width: number; height: number } | null = null;
let diagnosticLogged = false;

export function startTracking(taskType: "reading" | "pursuit", id: string) {
  frames = [];
  tracking = true;
  sessionTaskType = taskType;
  sessionId = id;
  taskBounds = null;
  diagnosticLogged = false;

  startDetection((landmarks, _videoSize) => {
    if (!tracking) return;
    try {
      const features = extractFrameFeatures(landmarks, Date.now());
      if (features) {
        frames.push(features);
        if (!diagnosticLogged) {
          console.log("[gaze-tracker] Data flowing.", {
            frames: frames.length,
            landmarks: landmarks.length,
            sampleCoord: [landmarks[0][0].toFixed(1), landmarks[0][1].toFixed(1)],
          });
          diagnosticLogged = true;
        }
      }
    } catch (e) {
      if (!diagnosticLogged) {
        console.warn("[gaze-tracker] Frame extraction error:", e);
        diagnosticLogged = true;
      }
    }
  });
}

export function setTrackingBounds(bounds: { x: number; y: number; width: number; height: number }) {
  taskBounds = bounds;
}

export function stopTracking(): ClinicalReport | null {
  tracking = false;
  stopDetection();
  console.log(`[gaze-tracker] Session ended. Collected ${frames.length} frames.`);
  const report = buildClinicalReport(frames, sessionId, sessionTaskType, taskBounds);
  frames = [];
  if (!report) { console.warn("[gaze-tracker] Could not build report (need >= 20 frames)."); }
  return report;
}

export function getFrameCount(): number { return frames.length; }
export type { ClinicalReport, FrameFeatures };

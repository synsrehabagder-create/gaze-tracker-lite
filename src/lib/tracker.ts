// Unified tracking module: collects per-frame features from WebGazer's FaceMesh
// and builds a comprehensive clinical report at session end.
//
// Uses WebGazer's gaze listener callback (fires each processed frame) instead of
// polling, which guarantees the tracker has fresh landmarks when we read them.

import { FrameFeatures, extractFrameFeatures } from "./frame-analyzer";
import { ClinicalReport, buildClinicalReport } from "./session-analyzer";

let frames: FrameFeatures[] = [];
let tracking = false;
let sessionTaskType: "reading" | "pursuit" = "reading";
let sessionId = "";
let taskBounds: { x: number; y: number; width: number; height: number } | null = null;
let diagnosticLogged = false;

function getVideoDimensions(): { width: number; height: number } {
  const video = document.getElementById("webgazerVideoFeed") as HTMLVideoElement | null;
  return {
    width: video?.videoWidth || 640,
    height: video?.videoHeight || 480,
  };
}

// MediaPipe FaceMesh may return landmarks as {x,y,z} objects or [x,y,z] arrays.
// Normalize to number[][] for frame-analyzer.
function toLandmarkArrays(raw: unknown[]): number[][] | null {
  if (!raw || raw.length === 0) return null;

  const first = raw[0];

  // Already number[][] (TF.js style)
  if (Array.isArray(first) && typeof first[0] === "number") {
    return raw as number[][];
  }

  // {x, y, z} object style (MediaPipe)
  if (first && typeof first === "object" && "x" in (first as Record<string, unknown>)) {
    return raw.map((p: any) => [p.x ?? 0, p.y ?? 0, p.z ?? 0]);
  }

  return null;
}

// If all coordinates are in 0-1 range, scale to video pixel dimensions
function scaleIfNormalized(positions: number[][]): number[][] {
  const sampleSize = Math.min(10, positions.length);
  let allNormalized = true;
  for (let i = 0; i < sampleSize; i++) {
    if (positions[i][0] > 1.0 || positions[i][1] > 1.0) {
      allNormalized = false;
      break;
    }
  }

  if (!allNormalized) return positions;

  const { width, height } = getVideoDimensions();
  return positions.map(p => [p[0] * width, p[1] * height, p[2] ?? 0]);
}

export function startTracking(webgazer: any, taskType: "reading" | "pursuit", id: string) {
  frames = [];
  tracking = true;
  sessionTaskType = taskType;
  sessionId = id;
  taskBounds = null;
  diagnosticLogged = false;

  // Use gaze listener callback: fires each time WebGazer processes a video frame.
  // At that point getPositions() has fresh FaceMesh landmarks.
  try {
    webgazer.setGazeListener((data: any, _elapsedTime: number) => {
      if (!tracking) return;

      try {
        const tracker = webgazer.getTracker();
        if (!tracker) return;

        const raw = tracker.getPositions?.();
        if (!raw || raw.length < 468) {
          if (!diagnosticLogged) {
            console.warn("[gaze-tracker] Landmarks not available from tracker.", {
              hasTracker: !!tracker,
              positionsLength: raw?.length ?? "null",
              trackerType: tracker?.constructor?.name,
            });
            diagnosticLogged = true;
          }
          return;
        }

        const arrays = toLandmarkArrays(raw);
        if (!arrays) {
          if (!diagnosticLogged) {
            console.warn("[gaze-tracker] Unknown landmark format:", typeof raw[0], raw[0]);
            diagnosticLogged = true;
          }
          return;
        }

        const scaled = scaleIfNormalized(arrays);
        const features = extractFrameFeatures(scaled, Date.now());
        if (features) {
          frames.push(features);
          if (!diagnosticLogged) {
            console.log("[gaze-tracker] Data flowing.", {
              frames: frames.length,
              landmarks: scaled.length,
              sampleCoord: [scaled[0][0].toFixed(1), scaled[0][1].toFixed(1)],
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
  } catch (e) {
    console.error("[gaze-tracker] Failed to set gaze listener:", e);
  }
}

export function setTrackingBounds(bounds: { x: number; y: number; width: number; height: number }) {
  taskBounds = bounds;
}

export function stopTracking(): ClinicalReport | null {
  tracking = false;

  console.log(`[gaze-tracker] Session ended. Collected ${frames.length} frames.`);

  const report = buildClinicalReport(frames, sessionId, sessionTaskType, taskBounds);
  frames = [];

  if (!report) {
    console.warn("[gaze-tracker] Could not build report (need >= 20 frames).");
  }

  return report;
}

export function getFrameCount(): number {
  return frames.length;
}

// Re-export types
export type { ClinicalReport, FrameFeatures };

// Unified tracking module: collects per-frame features from WebGazer's FaceMesh
// and builds a comprehensive clinical report at session end.

import { FrameFeatures, extractFrameFeatures } from "./frame-analyzer";
import { ClinicalReport, buildClinicalReport } from "./session-analyzer";

let frames: FrameFeatures[] = [];
let polling = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let sessionTaskType: "reading" | "pursuit" = "reading";
let sessionId = "";
let taskBounds: { x: number; y: number; width: number; height: number } | null = null;

export function startTracking(webgazer: any, taskType: "reading" | "pursuit", id: string) {
  frames = [];
  polling = true;
  sessionTaskType = taskType;
  sessionId = id;
  taskBounds = null;

  pollInterval = setInterval(() => {
    if (!polling) return;

    try {
      const tracker = webgazer.getTracker();
      if (!tracker) return;

      const positions = tracker.getPositions?.();
      if (!positions || positions.length < 468) return;

      const features = extractFrameFeatures(positions, Date.now());
      if (features) {
        frames.push(features);
      }
    } catch {
      // tracker not ready
    }
  }, 33); // ~30fps
}

export function setTrackingBounds(bounds: { x: number; y: number; width: number; height: number }) {
  taskBounds = bounds;
}

export function stopTracking(): ClinicalReport | null {
  polling = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  const report = buildClinicalReport(frames, sessionId, sessionTaskType, taskBounds);
  frames = [];
  return report;
}

export function getFrameCount(): number {
  return frames.length;
}

// Re-export types
export type { ClinicalReport, FrameFeatures };

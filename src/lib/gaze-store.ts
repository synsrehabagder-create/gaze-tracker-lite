// Simple in-memory store for gaze data during a session

export interface GazePoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface SessionData {
  id: string;
  type: "reading" | "pursuit";
  startTime: number;
  endTime?: number;
  gazePoints: GazePoint[];
  calibrationAccuracy?: number;
  taskAreaBounds?: { x: number; y: number; width: number; height: number };
}

export interface SessionReport {
  session: SessionData;
  totalDuration: number;
  totalGazePoints: number;
  onTaskPercentage: number;
  saccadeCount: number;
  regressionCount: number;
  smoothnessScore: number;
  avgFixationDuration: number;
}

let currentSession: SessionData | null = null;

export function startSession(type: "reading" | "pursuit"): SessionData {
  currentSession = {
    id: crypto.randomUUID(),
    type,
    startTime: Date.now(),
    gazePoints: [],
  };
  return currentSession;
}

export function addGazePoint(x: number, y: number) {
  if (!currentSession) return;
  currentSession.gazePoints.push({ x, y, timestamp: Date.now() });
}

export function setTaskAreaBounds(bounds: { x: number; y: number; width: number; height: number }) {
  if (!currentSession) return;
  currentSession.taskAreaBounds = bounds;
}

export function endSession(): SessionData | null {
  if (!currentSession) return null;
  currentSession.endTime = Date.now();
  const session = { ...currentSession };
  return session;
}

export function getSession(): SessionData | null {
  return currentSession;
}

export function analyzeSession(session: SessionData): SessionReport {
  const { gazePoints, taskAreaBounds } = session;
  const totalDuration = (session.endTime || Date.now()) - session.startTime;

  // On-task percentage
  let onTaskCount = 0;
  if (taskAreaBounds && gazePoints.length > 0) {
    const margin = 50;
    onTaskCount = gazePoints.filter(
      (p) =>
        p.x >= taskAreaBounds.x - margin &&
        p.x <= taskAreaBounds.x + taskAreaBounds.width + margin &&
        p.y >= taskAreaBounds.y - margin &&
        p.y <= taskAreaBounds.y + taskAreaBounds.height + margin
    ).length;
  }

  // Saccade detection (horizontal jumps > 80px)
  let saccadeCount = 0;
  let regressionCount = 0;
  const SACCADE_THRESHOLD = 80;

  for (let i = 1; i < gazePoints.length; i++) {
    const dx = gazePoints[i].x - gazePoints[i - 1].x;
    if (Math.abs(dx) > SACCADE_THRESHOLD) {
      saccadeCount++;
      if (dx < -SACCADE_THRESHOLD) {
        regressionCount++; // backward jump
      }
    }
  }

  // Smoothness: for pursuit, measure deviation from expected path
  // For reading, measure consistency of horizontal scanning
  let smoothnessScore = 100;
  if (gazePoints.length > 10) {
    let totalDeviation = 0;
    for (let i = 2; i < gazePoints.length; i++) {
      const expectedX = gazePoints[i - 1].x + (gazePoints[i - 1].x - gazePoints[i - 2].x);
      const expectedY = gazePoints[i - 1].y + (gazePoints[i - 1].y - gazePoints[i - 2].y);
      const deviation = Math.sqrt(
        Math.pow(gazePoints[i].x - expectedX, 2) + Math.pow(gazePoints[i].y - expectedY, 2)
      );
      totalDeviation += deviation;
    }
    const avgDeviation = totalDeviation / (gazePoints.length - 2);
    smoothnessScore = Math.max(0, Math.min(100, 100 - avgDeviation / 5));
  }

  // Avg fixation duration (time between saccades)
  const fixationDurations: number[] = [];
  let fixationStart = gazePoints[0]?.timestamp || 0;
  for (let i = 1; i < gazePoints.length; i++) {
    const dx = Math.abs(gazePoints[i].x - gazePoints[i - 1].x);
    if (dx > SACCADE_THRESHOLD) {
      fixationDurations.push(gazePoints[i].timestamp - fixationStart);
      fixationStart = gazePoints[i].timestamp;
    }
  }
  const avgFixationDuration =
    fixationDurations.length > 0
      ? fixationDurations.reduce((a, b) => a + b, 0) / fixationDurations.length
      : 0;

  return {
    session,
    totalDuration,
    totalGazePoints: gazePoints.length,
    onTaskPercentage: gazePoints.length > 0 ? (onTaskCount / gazePoints.length) * 100 : 0,
    saccadeCount,
    regressionCount,
    smoothnessScore: Math.round(smoothnessScore),
    avgFixationDuration: Math.round(avgFixationDuration),
  };
}

export function exportToJSON(report: SessionReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportToCSV(report: SessionReport): string {
  const headers = ["timestamp", "x", "y"];
  const rows = report.session.gazePoints.map((p) => `${p.timestamp},${Math.round(p.x)},${Math.round(p.y)}`);
  return [headers.join(","), ...rows].join("\n");
}

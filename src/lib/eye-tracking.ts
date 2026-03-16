// Per-eye tracking using WebGazer's internal FaceMesh landmarks
// MediaPipe FaceMesh eye landmark indices:
// Left eye corners: 33 (outer), 133 (inner)
// Right eye corners: 362 (inner), 263 (outer)
// Left iris center: 468 (if iris model enabled)
// Right iris center: 473 (if iris model enabled)
// Fallback: use eye corner midpoints

const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;

export interface EyeFrame {
  timestamp: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  pd: number; // pupil distance in pixels
}

let eyeFrames: EyeFrame[] = [];
let polling = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

function getEyeCenter(positions: number[][], indices: number[]): { x: number; y: number } | null {
  let sumX = 0, sumY = 0, count = 0;
  for (const idx of indices) {
    if (positions[idx]) {
      sumX += positions[idx][0];
      sumY += positions[idx][1];
      count++;
    }
  }
  if (count === 0) return null;
  return { x: sumX / count, y: sumY / count };
}

export function startEyeTracking(webgazer: any) {
  eyeFrames = [];
  polling = true;

  pollInterval = setInterval(() => {
    if (!polling) return;

    try {
      const tracker = webgazer.getTracker();
      if (!tracker) return;

      // Try to get mesh positions
      const positions = tracker.getPositions?.();
      if (!positions || positions.length < 468) return;

      const timestamp = Date.now();

      // Try iris landmarks first (indices 468-477), fall back to eye region center
      let leftEye: { x: number; y: number } | null = null;
      let rightEye: { x: number; y: number } | null = null;

      if (positions.length > RIGHT_IRIS_CENTER && positions[LEFT_IRIS_CENTER] && positions[RIGHT_IRIS_CENTER]) {
        leftEye = { x: positions[LEFT_IRIS_CENTER][0], y: positions[LEFT_IRIS_CENTER][1] };
        rightEye = { x: positions[RIGHT_IRIS_CENTER][0], y: positions[RIGHT_IRIS_CENTER][1] };
      } else {
        leftEye = getEyeCenter(positions, LEFT_EYE_INDICES);
        rightEye = getEyeCenter(positions, RIGHT_EYE_INDICES);
      }

      if (!leftEye || !rightEye) return;

      const pd = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

      eyeFrames.push({
        timestamp,
        leftX: leftEye.x,
        leftY: leftEye.y,
        rightX: rightEye.x,
        rightY: rightEye.y,
        pd,
      });
    } catch {
      // tracker not ready yet
    }
  }, 33); // ~30fps
}

export function stopEyeTracking(): EyeFrame[] {
  polling = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  const result = [...eyeFrames];
  eyeFrames = [];
  return result;
}

export interface EyeSyncReport {
  totalFrames: number;
  avgPD: number;
  pdVariation: number; // std dev of PD – high = inconsistent convergence
  syncScore: number; // 0-100, how synchronously the eyes move
  leftMovement: number; // total movement left eye
  rightMovement: number; // total movement right eye
  movementRatio: number; // ratio of L/R movement (1.0 = perfect sync)
  convergenceEvents: number; // times PD changed significantly
  eyeFrames: EyeFrame[];
}

export function analyzeEyeSync(frames: EyeFrame[]): EyeSyncReport | null {
  if (frames.length < 10) return null;

  // Average PD
  const pds = frames.map(f => f.pd);
  const avgPD = pds.reduce((a, b) => a + b, 0) / pds.length;
  const pdVariance = pds.reduce((a, b) => a + Math.pow(b - avgPD, 2), 0) / pds.length;
  const pdVariation = Math.sqrt(pdVariance);

  // Movement per eye
  let leftMovement = 0;
  let rightMovement = 0;
  let syncDeviationSum = 0;
  let convergenceEvents = 0;

  for (let i = 1; i < frames.length; i++) {
    const dLeftX = frames[i].leftX - frames[i - 1].leftX;
    const dLeftY = frames[i].leftY - frames[i - 1].leftY;
    const dRightX = frames[i].rightX - frames[i - 1].rightX;
    const dRightY = frames[i].rightY - frames[i - 1].rightY;

    const leftDist = Math.hypot(dLeftX, dLeftY);
    const rightDist = Math.hypot(dRightX, dRightY);

    leftMovement += leftDist;
    rightMovement += rightDist;

    // Sync: compare movement vectors (should be similar for conjugate movements)
    const diffX = Math.abs(dLeftX - dRightX);
    const diffY = Math.abs(dLeftY - dRightY);
    syncDeviationSum += Math.hypot(diffX, diffY);

    // Convergence event: PD changes > 2px between frames
    const dPD = Math.abs(frames[i].pd - frames[i - 1].pd);
    if (dPD > 2) convergenceEvents++;
  }

  const avgSyncDeviation = syncDeviationSum / (frames.length - 1);
  // Score: low deviation = high sync
  const syncScore = Math.max(0, Math.min(100, Math.round(100 - avgSyncDeviation * 10)));

  const movementRatio = rightMovement > 0 ? leftMovement / rightMovement : 1;

  return {
    totalFrames: frames.length,
    avgPD: Math.round(avgPD * 10) / 10,
    pdVariation: Math.round(pdVariation * 10) / 10,
    syncScore,
    leftMovement: Math.round(leftMovement),
    rightMovement: Math.round(rightMovement),
    movementRatio: Math.round(movementRatio * 100) / 100,
    convergenceEvents,
    eyeFrames: frames,
  };
}

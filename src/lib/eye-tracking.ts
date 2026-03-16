// Per-eye + head tracking using WebGazer's internal FaceMesh landmarks
// MediaPipe FaceMesh landmark indices:
// Left eye corners: 33 (outer), 133 (inner)
// Right eye corners: 362 (inner), 263 (outer)
// Left iris center: 468 (if iris model enabled)
// Right iris center: 473 (if iris model enabled)
// Nose tip: 1, Chin: 152, Forehead: 10
// Left cheek: 234, Right cheek: 454

const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;

// Head tracking landmarks
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

export interface EyeFrame {
  timestamp: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  pd: number;
}

export interface HeadFrame {
  timestamp: number;
  x: number; // nose tip X (horizontal position)
  y: number; // nose tip Y (vertical position)
  tilt: number; // head tilt angle (roll) in degrees
  nod: number; // vertical angle (pitch) approx
  turn: number; // horizontal angle (yaw) approx
}

let eyeFrames: EyeFrame[] = [];
let headFrames: HeadFrame[] = [];
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

function extractHeadPose(positions: number[][]): Omit<HeadFrame, "timestamp"> | null {
  const nose = positions[NOSE_TIP];
  const forehead = positions[FOREHEAD];
  const chin = positions[CHIN];
  const leftCheek = positions[LEFT_CHEEK];
  const rightCheek = positions[RIGHT_CHEEK];

  if (!nose || !forehead || !chin || !leftCheek || !rightCheek) return null;

  // Tilt (roll): angle of line between cheeks relative to horizontal
  const tilt = Math.atan2(rightCheek[1] - leftCheek[1], rightCheek[0] - leftCheek[0]) * (180 / Math.PI);

  // Nod (pitch): ratio of forehead-nose vs nose-chin distance
  const foreheadToNose = Math.hypot(forehead[0] - nose[0], forehead[1] - nose[1]);
  const noseToChin = Math.hypot(nose[0] - chin[0], nose[1] - chin[1]);
  const nod = foreheadToNose > 0 ? ((noseToChin / foreheadToNose) - 1) * 45 : 0; // rough degrees

  // Turn (yaw): ratio of nose-to-cheek distances
  const noseToLeft = Math.hypot(nose[0] - leftCheek[0], nose[1] - leftCheek[1]);
  const noseToRight = Math.hypot(nose[0] - rightCheek[0], nose[1] - rightCheek[1]);
  const turn = noseToRight > 0 ? ((noseToLeft / noseToRight) - 1) * 60 : 0; // rough degrees

  return {
    x: nose[0],
    y: nose[1],
    tilt: Math.round(tilt * 10) / 10,
    nod: Math.round(nod * 10) / 10,
    turn: Math.round(turn * 10) / 10,
  };
}

export function startEyeTracking(webgazer: any) {
  eyeFrames = [];
  headFrames = [];
  polling = true;

  pollInterval = setInterval(() => {
    if (!polling) return;

    try {
      const tracker = webgazer.getTracker();
      if (!tracker) return;

      const positions = tracker.getPositions?.();
      if (!positions || positions.length < 468) return;

      const timestamp = Date.now();

      // === Eye tracking ===
      let leftEye: { x: number; y: number } | null = null;
      let rightEye: { x: number; y: number } | null = null;

      if (positions.length > RIGHT_IRIS_CENTER && positions[LEFT_IRIS_CENTER] && positions[RIGHT_IRIS_CENTER]) {
        leftEye = { x: positions[LEFT_IRIS_CENTER][0], y: positions[LEFT_IRIS_CENTER][1] };
        rightEye = { x: positions[RIGHT_IRIS_CENTER][0], y: positions[RIGHT_IRIS_CENTER][1] };
      } else {
        leftEye = getEyeCenter(positions, LEFT_EYE_INDICES);
        rightEye = getEyeCenter(positions, RIGHT_EYE_INDICES);
      }

      if (leftEye && rightEye) {
        const pd = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
        eyeFrames.push({ timestamp, leftX: leftEye.x, leftY: leftEye.y, rightX: rightEye.x, rightY: rightEye.y, pd });
      }

      // === Head tracking ===
      const head = extractHeadPose(positions);
      if (head) {
        headFrames.push({ timestamp, ...head });
      }
    } catch {
      // tracker not ready yet
    }
  }, 33); // ~30fps
}

export function stopEyeTracking(): { eyeFrames: EyeFrame[]; headFrames: HeadFrame[] } {
  polling = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  const result = { eyeFrames: [...eyeFrames], headFrames: [...headFrames] };
  eyeFrames = [];
  headFrames = [];
  return result;
}

// ========== Eye Sync Analysis ==========

export interface EyeSyncReport {
  totalFrames: number;
  avgPD: number;
  pdVariation: number;
  syncScore: number;
  leftMovement: number;
  rightMovement: number;
  movementRatio: number;
  convergenceEvents: number;
  eyeFrames: EyeFrame[];
}

export function analyzeEyeSync(frames: EyeFrame[]): EyeSyncReport | null {
  if (frames.length < 10) return null;

  const pds = frames.map(f => f.pd);
  const avgPD = pds.reduce((a, b) => a + b, 0) / pds.length;
  const pdVariance = pds.reduce((a, b) => a + Math.pow(b - avgPD, 2), 0) / pds.length;
  const pdVariation = Math.sqrt(pdVariance);

  let leftMovement = 0;
  let rightMovement = 0;
  let syncDeviationSum = 0;
  let convergenceEvents = 0;

  for (let i = 1; i < frames.length; i++) {
    const dLeftX = frames[i].leftX - frames[i - 1].leftX;
    const dLeftY = frames[i].leftY - frames[i - 1].leftY;
    const dRightX = frames[i].rightX - frames[i - 1].rightX;
    const dRightY = frames[i].rightY - frames[i - 1].rightY;

    leftMovement += Math.hypot(dLeftX, dLeftY);
    rightMovement += Math.hypot(dRightX, dRightY);

    const diffX = Math.abs(dLeftX - dRightX);
    const diffY = Math.abs(dLeftY - dRightY);
    syncDeviationSum += Math.hypot(diffX, diffY);

    const dPD = Math.abs(frames[i].pd - frames[i - 1].pd);
    if (dPD > 2) convergenceEvents++;
  }

  const avgSyncDeviation = syncDeviationSum / (frames.length - 1);
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

// ========== Head Stability Analysis ==========

export interface HeadStabilityReport {
  totalFrames: number;
  totalMovement: number; // total px the head moved
  avgSpeed: number; // px per second
  maxTilt: number; // max tilt deviation
  maxTurn: number; // max turn deviation
  maxNod: number;
  stabilityScore: number; // 0-100
  headFrames: HeadFrame[];
}

export function analyzeHeadStability(frames: HeadFrame[]): HeadStabilityReport | null {
  if (frames.length < 10) return null;

  let totalMovement = 0;
  let maxTilt = 0;
  let maxTurn = 0;
  let maxNod = 0;

  // Baseline: first few frames average
  const baselineCount = Math.min(10, frames.length);
  let baseTilt = 0, baseTurn = 0, baseNod = 0;
  for (let i = 0; i < baselineCount; i++) {
    baseTilt += frames[i].tilt;
    baseTurn += frames[i].turn;
    baseNod += frames[i].nod;
  }
  baseTilt /= baselineCount;
  baseTurn /= baselineCount;
  baseNod /= baselineCount;

  for (let i = 1; i < frames.length; i++) {
    const dx = frames[i].x - frames[i - 1].x;
    const dy = frames[i].y - frames[i - 1].y;
    totalMovement += Math.hypot(dx, dy);

    maxTilt = Math.max(maxTilt, Math.abs(frames[i].tilt - baseTilt));
    maxTurn = Math.max(maxTurn, Math.abs(frames[i].turn - baseTurn));
    maxNod = Math.max(maxNod, Math.abs(frames[i].nod - baseNod));
  }

  const duration = (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000;
  const avgSpeed = duration > 0 ? totalMovement / duration : 0;

  // Stability: low movement + low rotation = high score
  // Normalize: avgSpeed < 20px/s and max angles < 5° = 100
  const speedPenalty = Math.min(50, avgSpeed * 1.5);
  const anglePenalty = Math.min(50, (maxTilt + maxTurn + maxNod) * 2);
  const stabilityScore = Math.max(0, Math.round(100 - speedPenalty - anglePenalty));

  return {
    totalFrames: frames.length,
    totalMovement: Math.round(totalMovement),
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    maxTilt: Math.round(maxTilt * 10) / 10,
    maxTurn: Math.round(maxTurn * 10) / 10,
    maxNod: Math.round(maxNod * 10) / 10,
    stabilityScore,
    headFrames: frames,
  };
}

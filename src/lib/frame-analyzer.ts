// Comprehensive per-frame feature extraction from MediaPipe FaceMesh (468+ landmarks)
// Extracts: eye positions, blink state, head pose, iris positions, eye openness

// ==================== Landmark indices ====================

// Eye contour landmarks
const LEFT_EYE_UPPER = [159, 158, 157, 173, 246, 161, 160];
const LEFT_EYE_LOWER = [145, 153, 154, 155, 133, 144, 163];
const LEFT_EYE_CORNER_OUTER = 33;
const LEFT_EYE_CORNER_INNER = 133;

// Classic 6-point EAR pairs (Soukupová & Čech) for reliable blink detection
// p1=outer, p2=upper1, p3=upper2, p4=inner, p5=lower2, p6=lower1
const LEFT_EAR_P2 = 159;  // upper lid center-outer
const LEFT_EAR_P3 = 158;  // upper lid center-inner
const LEFT_EAR_P5 = 153;  // lower lid center-inner
const LEFT_EAR_P6 = 145;  // lower lid center-outer

const RIGHT_EYE_UPPER = [386, 385, 384, 398, 466, 388, 387];
const RIGHT_EYE_LOWER = [374, 380, 381, 382, 362, 373, 390];
const RIGHT_EYE_CORNER_OUTER = 263;
const RIGHT_EYE_CORNER_INNER = 362;

// Iris landmarks (available when FaceMesh iris model is loaded)
const LEFT_IRIS = [468, 469, 470, 471, 472]; // 468 = center
const RIGHT_IRIS = [473, 474, 475, 476, 477]; // 473 = center

// Head pose landmarks
const NOSE_TIP = 1;
const NOSE_BRIDGE = 6;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const LEFT_EAR = 127;
const RIGHT_EAR = 356;
const LEFT_MOUTH = 61;
const RIGHT_MOUTH = 291;

// Eyebrow landmarks (for expressiveness / tension)
const LEFT_EYEBROW_UPPER = [70, 63, 105, 66, 107];
const RIGHT_EYEBROW_UPPER = [300, 293, 334, 296, 336];

// ==================== Types ====================

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FrameFeatures {
  timestamp: number;

  // Eye positions (center of eye region or iris if available)
  leftEye: Vec2;
  rightEye: Vec2;

  // Iris positions (null if iris model not available)
  leftIris: Vec2 | null;
  rightIris: Vec2 | null;

  // Eye openness (Eye Aspect Ratio)
  leftEAR: number;   // 0 = closed, ~0.2-0.4 = open
  rightEAR: number;

  // Blink state
  leftBlink: boolean;
  rightBlink: boolean;

  // Pupillary distance (between eye centers, in pixels)
  pd: number;

  // Iris-to-eye-corner ratio (gaze direction within eye socket)
  // 0 = looking far left, 0.5 = center, 1 = looking far right
  leftGazeRatio: number | null;
  rightGazeRatio: number | null;

  // Head pose
  headX: number;   // nose tip X
  headY: number;   // nose tip Y
  headTilt: number;  // roll in degrees
  headTurn: number;  // yaw (approx) in degrees
  headNod: number;   // pitch (approx) in degrees

  // Face scale (distance between ears - indicates distance from camera)
  faceWidth: number;

  // Eyebrow height (relative to eye - indicates strain/surprise)
  leftBrowHeight: number;
  rightBrowHeight: number;

  // Raw landmark count (for quality check)
  landmarkCount: number;
}

// ==================== Extraction ====================

const BLINK_EAR_THRESHOLD = 0.18;

function getLandmark(positions: number[][], index: number): Vec2 | null {
  const p = positions[index];
  if (!p) return null;
  return { x: p[0], y: p[1] };
}

function getLandmark3D(positions: number[][], index: number): Vec3 | null {
  const p = positions[index];
  if (!p) return null;
  return { x: p[0], y: p[1], z: p[2] || 0 };
}

function centroid(positions: number[][], indices: number[]): Vec2 | null {
  let sx = 0, sy = 0, n = 0;
  for (const i of indices) {
    if (positions[i]) {
      sx += positions[i][0];
      sy += positions[i][1];
      n++;
    }
  }
  return n > 0 ? { x: sx / n, y: sy / n } : null;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Eye Aspect Ratio (EAR) - Soukupová & Čech 2016
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * Low EAR = eye closing/blink
 */
function computeEAR(
  positions: number[][],
  upperIndices: number[],
  lowerIndices: number[],
  cornerOuter: number,
  cornerInner: number
): number {
  const outer = getLandmark(positions, cornerOuter);
  const inner = getLandmark(positions, cornerInner);
  if (!outer || !inner) return 0.3; // default open

  const eyeWidth = dist(outer, inner);
  if (eyeWidth < 1) return 0.3;

  // Average vertical distance at multiple points
  let vertSum = 0;
  let count = 0;
  const pairs = Math.min(upperIndices.length, lowerIndices.length);
  for (let i = 0; i < pairs; i++) {
    const upper = getLandmark(positions, upperIndices[i]);
    const lower = getLandmark(positions, lowerIndices[i]);
    if (upper && lower) {
      vertSum += dist(upper, lower);
      count++;
    }
  }

  if (count === 0) return 0.3;
  return (vertSum / count) / eyeWidth;
}

/**
 * Compute gaze ratio: where the iris sits between inner and outer corner
 * Returns 0-1 (0 = outer corner, 1 = inner corner)
 */
function computeGazeRatio(
  iris: Vec2 | null,
  positions: number[][],
  cornerOuter: number,
  cornerInner: number
): number | null {
  if (!iris) return null;
  const outer = getLandmark(positions, cornerOuter);
  const inner = getLandmark(positions, cornerInner);
  if (!outer || !inner) return null;

  const eyeWidth = dist(outer, inner);
  if (eyeWidth < 1) return null;

  const irisToOuter = dist(iris, outer);
  return Math.max(0, Math.min(1, irisToOuter / eyeWidth));
}

function computeHeadTilt(positions: number[][]): number {
  const left = getLandmark(positions, LEFT_CHEEK);
  const right = getLandmark(positions, RIGHT_CHEEK);
  if (!left || !right) return 0;
  return Math.atan2(right.y - left.y, right.x - left.x) * (180 / Math.PI);
}

function computeHeadTurn(positions: number[][]): number {
  const nose = getLandmark(positions, NOSE_TIP);
  const left = getLandmark(positions, LEFT_CHEEK);
  const right = getLandmark(positions, RIGHT_CHEEK);
  if (!nose || !left || !right) return 0;

  const noseToLeft = dist(nose, left);
  const noseToRight = dist(nose, right);
  return noseToRight > 0 ? ((noseToLeft / noseToRight) - 1) * 60 : 0;
}

function computeHeadNod(positions: number[][]): number {
  const nose = getLandmark(positions, NOSE_TIP);
  const forehead = getLandmark(positions, FOREHEAD);
  const chin = getLandmark(positions, CHIN);
  if (!nose || !forehead || !chin) return 0;

  const foreheadToNose = dist(forehead, nose);
  const noseToChin = dist(nose, chin);
  return foreheadToNose > 0 ? ((noseToChin / foreheadToNose) - 1) * 45 : 0;
}

function computeBrowHeight(positions: number[][], browIndices: number[], eyeUpperIndices: number[]): number {
  const brow = centroid(positions, browIndices);
  const eyeUpper = centroid(positions, eyeUpperIndices);
  if (!brow || !eyeUpper) return 0;
  return dist(brow, eyeUpper);
}

// ==================== Main extraction function ====================

export function extractFrameFeatures(positions: number[][], timestamp: number): FrameFeatures | null {
  if (!positions || positions.length < 468) return null;

  // Eye centers (from contour)
  const leftEye = centroid(positions, [...LEFT_EYE_UPPER, ...LEFT_EYE_LOWER]);
  const rightEye = centroid(positions, [...RIGHT_EYE_UPPER, ...RIGHT_EYE_LOWER]);
  if (!leftEye || !rightEye) return null;

  // Iris (may not be available)
  const hasIris = positions.length > 477 && positions[LEFT_IRIS[0]] && positions[RIGHT_IRIS[0]];
  const leftIris = hasIris ? getLandmark(positions, LEFT_IRIS[0]) : null;
  const rightIris = hasIris ? getLandmark(positions, RIGHT_IRIS[0]) : null;

  // EAR
  const leftEAR = computeEAR(positions, LEFT_EYE_UPPER, LEFT_EYE_LOWER, LEFT_EYE_CORNER_OUTER, LEFT_EYE_CORNER_INNER);
  const rightEAR = computeEAR(positions, RIGHT_EYE_UPPER, RIGHT_EYE_LOWER, RIGHT_EYE_CORNER_OUTER, RIGHT_EYE_CORNER_INNER);

  // Blink detection
  const leftBlink = leftEAR < BLINK_EAR_THRESHOLD;
  const rightBlink = rightEAR < BLINK_EAR_THRESHOLD;

  // PD
  const pd = dist(leftEye, rightEye);

  // Gaze ratios
  const leftGazeRatio = computeGazeRatio(leftIris, positions, LEFT_EYE_CORNER_OUTER, LEFT_EYE_CORNER_INNER);
  const rightGazeRatio = computeGazeRatio(rightIris, positions, RIGHT_EYE_CORNER_OUTER, RIGHT_EYE_CORNER_INNER);

  // Head pose
  const nose = getLandmark(positions, NOSE_TIP)!;
  const headTilt = computeHeadTilt(positions);
  const headTurn = computeHeadTurn(positions);
  const headNod = computeHeadNod(positions);

  // Face width (ear to ear, or cheek to cheek)
  const leftEar = getLandmark(positions, LEFT_EAR);
  const rightEar = getLandmark(positions, RIGHT_EAR);
  const faceWidth = leftEar && rightEar ? dist(leftEar, rightEar) : 0;

  // Brow heights
  const leftBrowHeight = computeBrowHeight(positions, LEFT_EYEBROW_UPPER, LEFT_EYE_UPPER);
  const rightBrowHeight = computeBrowHeight(positions, RIGHT_EYEBROW_UPPER, RIGHT_EYE_UPPER);

  return {
    timestamp,
    leftEye,
    rightEye,
    leftIris,
    rightIris,
    leftEAR,
    rightEAR,
    leftBlink,
    rightBlink,
    pd,
    leftGazeRatio,
    rightGazeRatio,
    headX: nose.x,
    headY: nose.y,
    headTilt: Math.round(headTilt * 10) / 10,
    headTurn: Math.round(headTurn * 10) / 10,
    headNod: Math.round(headNod * 10) / 10,
    faceWidth,
    leftBrowHeight,
    rightBrowHeight,
    landmarkCount: positions.length,
  };
}

// Session-level clinical analysis from per-frame features
// Computes: blink metrics, fixation analysis, saccade analysis,
// vergence tracking, head stability, attention metrics, eye-head coordination

import { FrameFeatures, Vec2 } from "./frame-analyzer";

// ==================== Types ====================

export interface BlinkMetrics {
  totalBlinks: number;
  blinksPerMinute: number;
  avgBlinkDuration: number;     // ms
  asymmetricBlinks: number;     // one eye blinks without the other
  longestNoBlink: number;       // ms – staring episodes
  blinkRegularity: number;      // 0-100, consistent spacing = high
}

export interface FixationMetrics {
  totalFixations: number;
  avgFixationDuration: number;  // ms
  medianFixationDuration: number;
  shortFixations: number;       // < 100ms (unstable)
  longFixations: number;        // > 600ms (stuck/zoning out)
  fixationStability: number;    // 0-100, low jitter during fixation = high
}

export interface SaccadeMetrics {
  totalSaccades: number;
  avgSaccadeAmplitude: number;  // pixels
  avgSaccadeVelocity: number;   // px/s
  forwardSaccades: number;
  regressions: number;          // backward saccades
  regressionPercentage: number;
  verticalSaccades: number;     // line changes in reading
}

export interface VergenceMetrics {
  avgPD: number;
  pdStdDev: number;
  convergenceEvents: number;    // PD decreased significantly
  divergenceEvents: number;     // PD increased significantly
  vergenceStability: number;    // 0-100
  pdTrend: "stable" | "converging" | "diverging"; // overall trend
}

export interface HeadMetrics {
  totalMovement: number;        // total px
  avgSpeed: number;             // px/s
  maxTiltDeviation: number;     // degrees
  maxTurnDeviation: number;
  maxNodDeviation: number;
  stabilityScore: number;       // 0-100
  compensatoryMovements: number; // head moves when eyes should
}

export interface AttentionMetrics {
  onTaskPercentage: number;
  attentionDrops: number;       // times gaze left task area
  avgOffTaskDuration: number;   // ms per excursion
  longestOffTask: number;       // ms
  fatigueIndex: number;         // 0-100, does performance degrade over time?
}

export interface EyeHeadCoordination {
  coordinationScore: number;    // 0-100
  headLeadEvents: number;       // head moves before eyes
  eyeLeadEvents: number;        // eyes move before head (normal)
  compensatoryRatio: number;    // how much head compensates for eye movement
}

export interface GazeDirectionMetrics {
  hasIrisData: boolean;
  avgLeftGazeRatio: number | null;
  avgRightGazeRatio: number | null;
  gazeAsymmetry: number | null;     // difference between eyes
  gazeRangeLeft: number | null;     // range of gaze movement left eye
  gazeRangeRight: number | null;
}

export interface ClinicalReport {
  sessionId: string;
  taskType: "reading" | "pursuit";
  duration: number;             // ms
  totalFrames: number;
  fps: number;
  blinks: BlinkMetrics;
  fixations: FixationMetrics;
  saccades: SaccadeMetrics;
  vergence: VergenceMetrics;
  head: HeadMetrics;
  attention: AttentionMetrics;
  eyeHead: EyeHeadCoordination;
  gazeDirection: GazeDirectionMetrics;
  frames: FrameFeatures[];      // raw data for visualization
  flags: ClinicalFlag[];        // auto-detected concerns
}

export interface ClinicalFlag {
  severity: "info" | "mild" | "moderate" | "significant";
  category: string;
  label: string;
  description: string;
  value: string;
}

// ==================== Analysis functions ====================

function analyzeBlinkMetrics(frames: FrameFeatures[], durationMs: number): BlinkMetrics {
  const blinks: { start: number; end: number; asymmetric: boolean }[] = [];
  let inBlink = false;
  let blinkStart = 0;

  for (let i = 0; i < frames.length; i++) {
    const bothBlink = frames[i].leftBlink && frames[i].rightBlink;
    const oneBlink = frames[i].leftBlink !== frames[i].rightBlink;

    if ((bothBlink || oneBlink) && !inBlink) {
      inBlink = true;
      blinkStart = frames[i].timestamp;
    } else if (!frames[i].leftBlink && !frames[i].rightBlink && inBlink) {
      inBlink = false;
      blinks.push({
        start: blinkStart,
        end: frames[i].timestamp,
        asymmetric: false, // will compute below
      });
    }
  }

  // Detect asymmetric blinks (only one eye closes)
  let asymmetricBlinks = 0;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].leftBlink !== frames[i].rightBlink) {
      // Check if this is sustained (not just noise)
      let sustained = 0;
      for (let j = i; j < Math.min(i + 5, frames.length); j++) {
        if (frames[j].leftBlink !== frames[j].rightBlink) sustained++;
      }
      if (sustained >= 3) {
        asymmetricBlinks++;
        i += 4; // skip ahead
      }
    }
  }

  const durations = blinks.map(b => b.end - b.start).filter(d => d > 30 && d < 800);
  const avgBlinkDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  // Longest no-blink interval
  let longestNoBlink = 0;
  for (let i = 1; i < blinks.length; i++) {
    const gap = blinks[i].start - blinks[i - 1].end;
    longestNoBlink = Math.max(longestNoBlink, gap);
  }

  // Blink regularity (coefficient of variation of inter-blink intervals)
  const intervals: number[] = [];
  for (let i = 1; i < blinks.length; i++) {
    intervals.push(blinks[i].start - blinks[i - 1].start);
  }
  let blinkRegularity = 50;
  if (intervals.length > 2) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length);
    const cv = mean > 0 ? stdDev / mean : 1;
    blinkRegularity = Math.max(0, Math.min(100, Math.round(100 - cv * 100)));
  }

  const minutes = durationMs / 60000;
  return {
    totalBlinks: blinks.length,
    blinksPerMinute: minutes > 0 ? Math.round(blinks.length / minutes * 10) / 10 : 0,
    avgBlinkDuration: Math.round(avgBlinkDuration),
    asymmetricBlinks,
    longestNoBlink: Math.round(longestNoBlink),
    blinkRegularity,
  };
}

function analyzeFixations(frames: FrameFeatures[]): FixationMetrics {
  // Compute median PD for scale-relative thresholds
  const pds = frames.map(f => f.pd).sort((a, b) => a - b);
  const medianPD = pds[Math.floor(pds.length / 2)] || 50;

  // Thresholds as fraction of PD (eye movements in landmark space are small)
  const FIXATION_THRESHOLD = medianPD * 0.08; // ~4px at PD=50
  const MIN_FIXATION_MS = 50;

  const fixations: { start: number; end: number; jitter: number }[] = [];
  let fixStart = 0;
  let fixCenterX = frames[0]?.leftEye.x || 0;
  let fixCenterY = frames[0]?.leftEye.y || 0;
  let jitterSum = 0;
  let jitterCount = 0;

  for (let i = 1; i < frames.length; i++) {
    const eye = frames[i].leftIris || frames[i].leftEye;
    const dx = eye.x - fixCenterX;
    const dy = eye.y - fixCenterY;
    const movement = Math.hypot(dx, dy);

    if (movement < FIXATION_THRESHOLD) {
      jitterSum += movement;
      jitterCount++;
    } else {
      const dur = frames[i].timestamp - frames[fixStart].timestamp;
      if (dur >= MIN_FIXATION_MS) {
        fixations.push({
          start: frames[fixStart].timestamp,
          end: frames[i].timestamp,
          jitter: jitterCount > 0 ? jitterSum / jitterCount : 0,
        });
      }
      fixStart = i;
      fixCenterX = eye.x;
      fixCenterY = eye.y;
      jitterSum = 0;
      jitterCount = 0;
    }
  }

  const durations = fixations.map(f => f.end - f.start);
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const avgJitter = fixations.length > 0 ? fixations.reduce((a, f) => a + f.jitter, 0) / fixations.length : 0;
  // Normalize jitter penalty by PD scale
  const normalizedJitter = medianPD > 0 ? (avgJitter / medianPD) * 100 : avgJitter;
  const fixationStability = Math.max(0, Math.min(100, Math.round(100 - normalizedJitter * 20)));

  return {
    totalFixations: fixations.length,
    avgFixationDuration: Math.round(avg),
    medianFixationDuration: Math.round(median),
    shortFixations: durations.filter(d => d < 100).length,
    longFixations: durations.filter(d => d > 600).length,
    fixationStability,
  };
}

function analyzeSaccades(frames: FrameFeatures[]): SaccadeMetrics {
  // Compute median PD for scale-relative threshold
  const pds = frames.map(f => f.pd).sort((a, b) => a - b);
  const medianPD = pds[Math.floor(pds.length / 2)] || 50;

  // Saccade = eye movement > 15% of PD between frames (~7px at PD=50)
  const SACCADE_THRESHOLD = medianPD * 0.15;
  const saccades: { amplitude: number; velocity: number; direction: "forward" | "backward" | "vertical" }[] = [];

  for (let i = 1; i < frames.length; i++) {
    const eye = frames[i].leftIris || frames[i].leftEye;
    const prevEye = frames[i - 1].leftIris || frames[i - 1].leftEye;

    const dx = eye.x - prevEye.x;
    const dy = eye.y - prevEye.y;
    const amplitude = Math.hypot(dx, dy);
    const dt = (frames[i].timestamp - frames[i - 1].timestamp) / 1000;

    if (amplitude > SACCADE_THRESHOLD && dt > 0) {
      const velocity = amplitude / dt;
      let direction: "forward" | "backward" | "vertical";

      if (Math.abs(dy) > Math.abs(dx) * 1.5) {
        direction = "vertical";
      } else if (dx > 0) {
        direction = "forward";
      } else {
        direction = "backward";
      }

      saccades.push({ amplitude, velocity, direction });
    }
  }

  const forward = saccades.filter(s => s.direction === "forward").length;
  const backward = saccades.filter(s => s.direction === "backward").length;
  const vertical = saccades.filter(s => s.direction === "vertical").length;

  return {
    totalSaccades: saccades.length,
    avgSaccadeAmplitude: saccades.length > 0 ? Math.round(saccades.reduce((a, s) => a + s.amplitude, 0) / saccades.length * 10) / 10 : 0,
    avgSaccadeVelocity: saccades.length > 0 ? Math.round(saccades.reduce((a, s) => a + s.velocity, 0) / saccades.length) : 0,
    forwardSaccades: forward,
    regressions: backward,
    regressionPercentage: saccades.length > 0 ? Math.round((backward / saccades.length) * 100) : 0,
    verticalSaccades: vertical,
  };
}

function analyzeVergence(frames: FrameFeatures[]): VergenceMetrics {
  const pds = frames.map(f => f.pd);
  const avgPD = pds.reduce((a, b) => a + b, 0) / pds.length;
  const pdStdDev = Math.sqrt(pds.reduce((a, b) => a + Math.pow(b - avgPD, 2), 0) / pds.length);

  let convergenceEvents = 0;
  let divergenceEvents = 0;
  const PD_EVENT_THRESHOLD = 3; // px change

  for (let i = 1; i < frames.length; i++) {
    const dPD = frames[i].pd - frames[i - 1].pd;
    if (dPD < -PD_EVENT_THRESHOLD) convergenceEvents++;
    if (dPD > PD_EVENT_THRESHOLD) divergenceEvents++;
  }

  // Trend: compare first and last quarter averages
  const q = Math.floor(frames.length / 4);
  const firstQ = pds.slice(0, q);
  const lastQ = pds.slice(-q);
  const firstAvg = firstQ.reduce((a, b) => a + b, 0) / firstQ.length;
  const lastAvg = lastQ.reduce((a, b) => a + b, 0) / lastQ.length;
  const diff = lastAvg - firstAvg;
  const pdTrend: "stable" | "converging" | "diverging" =
    Math.abs(diff) < 2 ? "stable" : diff < 0 ? "converging" : "diverging";

  const vergenceStability = Math.max(0, Math.min(100, Math.round(100 - pdStdDev * 10)));

  return {
    avgPD: Math.round(avgPD * 10) / 10,
    pdStdDev: Math.round(pdStdDev * 10) / 10,
    convergenceEvents,
    divergenceEvents,
    vergenceStability,
    pdTrend,
  };
}

function analyzeHead(frames: FrameFeatures[], durationMs: number): HeadMetrics {
  let totalMovement = 0;

  // Baseline from first 10 frames
  const baseN = Math.min(10, frames.length);
  let baseTilt = 0, baseTurn = 0, baseNod = 0;
  for (let i = 0; i < baseN; i++) {
    baseTilt += frames[i].headTilt;
    baseTurn += frames[i].headTurn;
    baseNod += frames[i].headNod;
  }
  baseTilt /= baseN;
  baseTurn /= baseN;
  baseNod /= baseN;

  let maxTilt = 0, maxTurn = 0, maxNod = 0;

  for (let i = 1; i < frames.length; i++) {
    totalMovement += Math.hypot(frames[i].headX - frames[i - 1].headX, frames[i].headY - frames[i - 1].headY);
    maxTilt = Math.max(maxTilt, Math.abs(frames[i].headTilt - baseTilt));
    maxTurn = Math.max(maxTurn, Math.abs(frames[i].headTurn - baseTurn));
    maxNod = Math.max(maxNod, Math.abs(frames[i].headNod - baseNod));
  }

  const seconds = durationMs / 1000;
  const avgSpeed = seconds > 0 ? totalMovement / seconds : 0;

  // Compensatory head movements: head moves in same direction as expected eye movement
  // Use PD-relative threshold
  const compPds = frames.map(f => f.pd).sort((a, b) => a - b);
  const compMedianPD = compPds[Math.floor(compPds.length / 2)] || 50;
  const headMoveThreshold = compMedianPD * 0.04; // ~2px at PD=50
  let compensatoryMovements = 0;
  for (let i = 1; i < frames.length; i++) {
    const headDx = frames[i].headX - frames[i - 1].headX;
    const eyeDx = (frames[i].leftEye.x - frames[i - 1].leftEye.x);
    if (Math.abs(headDx) > headMoveThreshold && headDx * eyeDx > 0) {
      compensatoryMovements++;
    }
  }

  const speedPenalty = Math.min(50, avgSpeed * 1.5);
  const anglePenalty = Math.min(50, (maxTilt + maxTurn + maxNod) * 2);
  const stabilityScore = Math.max(0, Math.round(100 - speedPenalty - anglePenalty));

  return {
    totalMovement: Math.round(totalMovement),
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    maxTiltDeviation: Math.round(maxTilt * 10) / 10,
    maxTurnDeviation: Math.round(maxTurn * 10) / 10,
    maxNodDeviation: Math.round(maxNod * 10) / 10,
    stabilityScore,
    compensatoryMovements,
  };
}

function analyzeAttention(
  frames: FrameFeatures[],
  _taskBounds: { x: number; y: number; width: number; height: number } | null
): AttentionMetrics {
  if (frames.length < 10) {
    return { onTaskPercentage: 0, attentionDrops: 0, avgOffTaskDuration: 0, longestOffTask: 0, fatigueIndex: 0 };
  }

  // Since FaceMesh landmarks are in video-frame coordinates (not screen coords),
  // we can't compare to DOM taskBounds. Instead, use a statistical approach:
  // compute the "home" position from the median, and flag frames that deviate significantly.
  const pds = frames.map(f => f.pd).sort((a, b) => a - b);
  const medianPD = pds[Math.floor(pds.length / 2)] || 50;

  // Compute median head position as "on-task" reference
  const headXs = frames.map(f => f.headX).sort((a, b) => a - b);
  const headYs = frames.map(f => f.headY).sort((a, b) => a - b);
  const medianHeadX = headXs[Math.floor(headXs.length / 2)];
  const medianHeadY = headYs[Math.floor(headYs.length / 2)];

  // "Off-task" = head deviates more than 1.5x PD from median position
  const offTaskThreshold = medianPD * 1.5;

  let onTask = 0;
  let offTaskStart: number | null = null;
  let drops = 0;
  const offTaskDurations: number[] = [];

  for (const f of frames) {
    const deviation = Math.hypot(f.headX - medianHeadX, f.headY - medianHeadY);
    const isOnTask = deviation < offTaskThreshold;

    if (isOnTask) {
      onTask++;
      if (offTaskStart !== null) {
        offTaskDurations.push(f.timestamp - offTaskStart);
        offTaskStart = null;
      }
    } else {
      if (offTaskStart === null) {
        offTaskStart = f.timestamp;
        drops++;
      }
    }
  }

  const longestOffTask = offTaskDurations.length > 0 ? Math.max(...offTaskDurations) : 0;
  const avgOffTask = offTaskDurations.length > 0 ? offTaskDurations.reduce((a, b) => a + b, 0) / offTaskDurations.length : 0;

  // Fatigue: compare first half stability vs second half
  const half = Math.floor(frames.length / 2);
  const firstHalf = frames.slice(0, half);
  const secondHalf = frames.slice(half);

  const firstJitter = computeAvgJitter(firstHalf);
  const secondJitter = computeAvgJitter(secondHalf);
  const fatigueIndex = firstJitter > 0 && secondJitter > firstJitter * 1.3
    ? Math.min(100, Math.round((secondJitter / firstJitter - 1) * 100))
    : 0;

  return {
    onTaskPercentage: Math.round((onTask / frames.length) * 100),
    attentionDrops: drops,
    avgOffTaskDuration: Math.round(avgOffTask),
    longestOffTask: Math.round(longestOffTask),
    fatigueIndex,
  };
}

function computeAvgJitter(frames: FrameFeatures[]): number {
  if (frames.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < frames.length; i++) {
    total += Math.hypot(
      frames[i].leftEye.x - frames[i - 1].leftEye.x,
      frames[i].leftEye.y - frames[i - 1].leftEye.y
    );
  }
  return total / (frames.length - 1);
}

function analyzeEyeHeadCoordination(frames: FrameFeatures[]): EyeHeadCoordination {
  let headLeadEvents = 0;
  let eyeLeadEvents = 0;
  let totalCompensation = 0;

  for (let i = 2; i < frames.length; i++) {
    const headMove = Math.abs(frames[i - 1].headX - frames[i - 2].headX);
    const eyeMove = Math.abs(frames[i].leftEye.x - frames[i - 1].leftEye.x);
    const prevEyeMove = Math.abs(frames[i - 1].leftEye.x - frames[i - 2].leftEye.x);
    const prevHeadMove = Math.abs(frames[i].headX - frames[i - 1].headX);

    if (headMove > 5 && eyeMove > 5) {
      // Threshold relative to landmark scale — lower for FaceMesh coords
      if (headMove > 2 && eyeMove > 2) {
        if (headMove > prevEyeMove && eyeMove > prevHeadMove) headLeadEvents++;
        else eyeLeadEvents++;
      }
    }

    if (headMove > 3) totalCompensation += headMove;
  }

  const totalEyeMove = frames.reduce((sum, f, i) => {
    if (i === 0) return 0;
    return sum + Math.abs(f.leftEye.x - frames[i - 1].leftEye.x);
  }, 0);

  const compensatoryRatio = totalEyeMove > 0 ? Math.round((totalCompensation / totalEyeMove) * 100) / 100 : 0;
  const total = headLeadEvents + eyeLeadEvents;
  const coordinationScore = total > 0 ? Math.round((eyeLeadEvents / total) * 100) : 50;

  return { coordinationScore, headLeadEvents, eyeLeadEvents, compensatoryRatio };
}

function analyzeGazeDirection(frames: FrameFeatures[]): GazeDirectionMetrics {
  const leftRatios = frames.map(f => f.leftGazeRatio).filter((r): r is number => r !== null);
  const rightRatios = frames.map(f => f.rightGazeRatio).filter((r): r is number => r !== null);
  const hasIris = leftRatios.length > 10;

  if (!hasIris) {
    return { hasIrisData: false, avgLeftGazeRatio: null, avgRightGazeRatio: null, gazeAsymmetry: null, gazeRangeLeft: null, gazeRangeRight: null };
  }

  const avgLeft = leftRatios.reduce((a, b) => a + b, 0) / leftRatios.length;
  const avgRight = rightRatios.reduce((a, b) => a + b, 0) / rightRatios.length;

  return {
    hasIrisData: true,
    avgLeftGazeRatio: Math.round(avgLeft * 100) / 100,
    avgRightGazeRatio: Math.round(avgRight * 100) / 100,
    gazeAsymmetry: Math.round(Math.abs(avgLeft - avgRight) * 100) / 100,
    gazeRangeLeft: Math.round((Math.max(...leftRatios) - Math.min(...leftRatios)) * 100) / 100,
    gazeRangeRight: Math.round((Math.max(...rightRatios) - Math.min(...rightRatios)) * 100) / 100,
  };
}

// ==================== Clinical flags ====================

function generateFlags(report: Omit<ClinicalReport, "flags">): ClinicalFlag[] {
  const flags: ClinicalFlag[] = [];

  // Blink flags
  if (report.blinks.blinksPerMinute < 8) {
    flags.push({ severity: "mild", category: "Blunking", label: "Lav blunkefrekvens", description: "Under 8 blunk/min kan indikere anstrengt fokus eller tørrhet", value: `${report.blinks.blinksPerMinute}/min` });
  }
  if (report.blinks.blinksPerMinute > 25) {
    flags.push({ severity: "mild", category: "Blunking", label: "Høy blunkefrekvens", description: "Over 25 blunk/min kan indikere ubehag eller stress", value: `${report.blinks.blinksPerMinute}/min` });
  }
  if (report.blinks.asymmetricBlinks > 3) {
    flags.push({ severity: "moderate", category: "Blunking", label: "Asymmetrisk blunking", description: "Flere tilfeller der bare ett øye lukker seg", value: `${report.blinks.asymmetricBlinks} ganger` });
  }
  if (report.blinks.longestNoBlink > 15000) {
    flags.push({ severity: "info", category: "Blunking", label: "Lang stirreperiode", description: "Over 15 sekunder uten blunking", value: `${Math.round(report.blinks.longestNoBlink / 1000)}s` });
  }

  // Fixation flags
  if (report.fixations.shortFixations > report.fixations.totalFixations * 0.3) {
    flags.push({ severity: "moderate", category: "Fiksering", label: "Mange korte fikseringer", description: "Over 30% av fikseringene er under 100ms – kan indikere ustabilt blikk", value: `${report.fixations.shortFixations} korte` });
  }
  if (report.fixations.longFixations > 5) {
    flags.push({ severity: "mild", category: "Fiksering", label: "Langvarige fikseringer", description: "Flere fikseringer over 600ms – kan indikere prosesseringsvansker", value: `${report.fixations.longFixations} lange` });
  }

  // Saccade flags
  if (report.saccades.regressionPercentage > 20) {
    flags.push({ severity: "moderate", category: "Sakkader", label: "Høy regresjonsandel", description: "Over 20% tilbakehopp kan indikere lesevansker", value: `${report.saccades.regressionPercentage}%` });
  }

  // Vergence flags
  if (report.vergence.pdStdDev > 5) {
    flags.push({ severity: "moderate", category: "Vergens", label: "Ustabil pupillavstand", description: "Stor variasjon i PD kan indikere konvergensvansker", value: `±${report.vergence.pdStdDev} px` });
  }
  if (report.vergence.pdTrend !== "stable") {
    flags.push({ severity: "mild", category: "Vergens", label: `PD-trend: ${report.vergence.pdTrend === "converging" ? "konvergerer" : "divergerer"}`, description: "Pupillavstanden endrer seg gjennom økten", value: report.vergence.pdTrend });
  }

  // Head flags
  if (report.head.stabilityScore < 40) {
    flags.push({ severity: "moderate", category: "Hode", label: "Urolig hode", description: "Mye hodebevegelse under oppgaven", value: `${report.head.stabilityScore}% stabilitet` });
  }
  if (report.head.compensatoryMovements > 20) {
    flags.push({ severity: "significant", category: "Hode", label: "Kompensatoriske hodebevegelser", description: "Hodet beveger seg i stedet for øynene – kan indikere øyemotoriske vansker", value: `${report.head.compensatoryMovements} hendelser` });
  }

  // Eye-head coordination
  if (report.eyeHead.coordinationScore < 30) {
    flags.push({ severity: "moderate", category: "Koordinering", label: "Svak øye-hode-koordinering", description: "Hodet leder bevegelsen oftere enn øynene", value: `${report.eyeHead.coordinationScore}%` });
  }

  // Attention
  if (report.attention.fatigueIndex > 30) {
    flags.push({ severity: "mild", category: "Oppmerksomhet", label: "Tegn til utmattelse", description: "Blikkstabiliteten ble dårligere mot slutten av oppgaven", value: `${report.attention.fatigueIndex}% forverring` });
  }

  return flags.sort((a, b) => {
    const order = { significant: 0, moderate: 1, mild: 2, info: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ==================== Main analysis ====================

export function buildClinicalReport(
  frames: FrameFeatures[],
  sessionId: string,
  taskType: "reading" | "pursuit",
  taskBounds: { x: number; y: number; width: number; height: number } | null
): ClinicalReport | null {
  if (frames.length < 20) return null;

  const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;
  const fps = duration > 0 ? Math.round((frames.length / duration) * 1000 * 10) / 10 : 0;

  const partial: Omit<ClinicalReport, "flags"> = {
    sessionId,
    taskType,
    duration,
    totalFrames: frames.length,
    fps,
    blinks: analyzeBlinkMetrics(frames, duration),
    fixations: analyzeFixations(frames),
    saccades: analyzeSaccades(frames),
    vergence: analyzeVergence(frames),
    head: analyzeHead(frames, duration),
    attention: analyzeAttention(frames, taskBounds),
    eyeHead: analyzeEyeHeadCoordination(frames),
    gazeDirection: analyzeGazeDirection(frames),
    frames,
  };

  return {
    ...partial,
    flags: generateFlags(partial),
  };
}

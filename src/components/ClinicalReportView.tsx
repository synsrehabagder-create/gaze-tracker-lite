import { ClinicalReport, ClinicalFlag } from "@/lib/session-analyzer";
import {
  Eye, Activity, BarChart3, AlertTriangle, Move, Brain,
  Zap, ArrowLeftRight, TrendingDown, Timer, Scan, ChevronDown
} from "lucide-react";
import { useState } from "react";

// ==================== Shared components ====================

function MetricCard({ icon, label, value, unit, desc, status }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  desc: string;
  status?: "good" | "warn" | "bad" | "neutral";
}) {
  const color = status === "good" ? "text-success" : status === "warn" ? "text-orange-500" : status === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="card-surface p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value}{unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}
      </p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-surface overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-accent/50 transition-clinical"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </div>
  );
}

// ==================== Section components ====================

function FlagsBanner({ flags }: { flags: ClinicalFlag[] }) {
  if (flags.length === 0) return (
    <div className="card-surface p-4 border-l-4 border-success">
      <p className="text-sm text-success font-medium">Ingen kliniske funn å flagge</p>
    </div>
  );

  const severityStyles = {
    significant: "border-destructive bg-destructive/5",
    moderate: "border-orange-500 bg-orange-500/5",
    mild: "border-primary bg-primary/5",
    info: "border-muted-foreground bg-muted/50",
  };

  const severityLabels = {
    significant: "Betydelig",
    moderate: "Moderat",
    mild: "Mild",
    info: "Info",
  };

  return (
    <div className="space-y-2">
      {flags.map((flag, i) => (
        <div key={i} className={`card-surface p-4 border-l-4 ${severityStyles[flag.severity]}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{flag.category}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{severityLabels[flag.severity]}</span>
              </div>
              <p className="text-sm font-medium text-foreground mt-0.5">{flag.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
            </div>
            <span className="text-sm font-bold tabular-nums text-foreground whitespace-nowrap">{flag.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlinkSection({ report }: { report: ClinicalReport }) {
  const { blinks } = report;
  const rateStatus = blinks.blinksPerMinute >= 10 && blinks.blinksPerMinute <= 20 ? "good" : "warn";

  return (
    <Section title="Blunking" icon={<Eye className="w-4 h-4 text-muted-foreground" />}>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Eye className="w-4 h-4" />} label="Frekvens" value={blinks.blinksPerMinute} unit="/min" desc="Normalt: 10-20/min" status={rateStatus} />
        <MetricCard icon={<Timer className="w-4 h-4" />} label="Gj.snitt varighet" value={blinks.avgBlinkDuration} unit="ms" desc="Normalt: 100-400ms" status={blinks.avgBlinkDuration > 50 && blinks.avgBlinkDuration < 500 ? "good" : "warn"} />
      </div>
      <div className="space-y-2 text-sm">
        <DetailRow label="Totale blunk" value={blinks.totalBlinks} />
        <DetailRow label="Asymmetriske blunk" value={blinks.asymmetricBlinks} />
        <DetailRow label="Lengste stirring" value={`${Math.round(blinks.longestNoBlink / 1000)}s`} />
        <DetailRow label="Regularitet" value={`${blinks.blinkRegularity}%`} />
      </div>
    </Section>
  );
}

function FixationSection({ report }: { report: ClinicalReport }) {
  const { fixations } = report;
  return (
    <Section title="Fikseringer" icon={<Scan className="w-4 h-4 text-muted-foreground" />}>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Scan className="w-4 h-4" />} label="Stabilitet" value={fixations.fixationStability} unit="%" desc="Jitter under fiksering" status={fixations.fixationStability > 60 ? "good" : fixations.fixationStability > 30 ? "warn" : "bad"} />
        <MetricCard icon={<Timer className="w-4 h-4" />} label="Gj.snitt varighet" value={fixations.avgFixationDuration} unit="ms" desc="Normalt: 200-400ms" />
      </div>
      <div className="space-y-2 text-sm">
        <DetailRow label="Totale fikseringer" value={fixations.totalFixations} />
        <DetailRow label="Median varighet" value={`${fixations.medianFixationDuration} ms`} />
        <DetailRow label="Korte (<100ms)" value={fixations.shortFixations} />
        <DetailRow label="Lange (>600ms)" value={fixations.longFixations} />
      </div>
    </Section>
  );
}

function SaccadeSection({ report }: { report: ClinicalReport }) {
  const { saccades } = report;
  return (
    <Section title="Sakkader" icon={<Zap className="w-4 h-4 text-muted-foreground" />}>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<BarChart3 className="w-4 h-4" />} label="Regresjoner" value={saccades.regressionPercentage} unit="%" desc="Tilbakehopp" status={saccades.regressionPercentage < 15 ? "good" : saccades.regressionPercentage < 25 ? "warn" : "bad"} />
        <MetricCard icon={<Zap className="w-4 h-4" />} label="Hastighet" value={saccades.avgSaccadeVelocity} unit="px/s" desc="Snitt sakkadehastighet" />
      </div>
      <div className="space-y-2 text-sm">
        <DetailRow label="Totale sakkader" value={saccades.totalSaccades} />
        <DetailRow label="Fremover" value={saccades.forwardSaccades} />
        <DetailRow label="Tilbake (regresjoner)" value={saccades.regressions} />
        <DetailRow label="Vertikale (linjeskift)" value={saccades.verticalSaccades} />
        <DetailRow label="Snitt amplitude" value={`${saccades.avgSaccadeAmplitude} px`} />
      </div>
    </Section>
  );
}

function VergenceSection({ report }: { report: ClinicalReport }) {
  const { vergence } = report;
  const trendLabel = vergence.pdTrend === "stable" ? "Stabil" : vergence.pdTrend === "converging" ? "Konvergerer" : "Divergerer";
  return (
    <Section title="Vergens (øyesamarbeid)" icon={<ArrowLeftRight className="w-4 h-4 text-muted-foreground" />}>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<ArrowLeftRight className="w-4 h-4" />} label="Stabilitet" value={vergence.vergenceStability} unit="%" desc="Jevn pupillavstand" status={vergence.vergenceStability > 60 ? "good" : vergence.vergenceStability > 30 ? "warn" : "bad"} />
        <MetricCard icon={<TrendingDown className="w-4 h-4" />} label="PD-trend" value={trendLabel} desc={`Snitt PD: ${vergence.avgPD} px`} status={vergence.pdTrend === "stable" ? "good" : "warn"} />
      </div>
      <div className="space-y-2 text-sm">
        <DetailRow label="Snitt pupillavstand" value={`${vergence.avgPD} px`} />
        <DetailRow label="PD standardavvik" value={`±${vergence.pdStdDev} px`} />
        <DetailRow label="Konvergenshendelser" value={vergence.convergenceEvents} />
        <DetailRow label="Divergenshendelser" value={vergence.divergenceEvents} />
      </div>
    </Section>
  );
}

function HeadSection({ report }: { report: ClinicalReport }) {
  const { head } = report;
  return (
    <Section title="Hodestabilitet" icon={<Move className="w-4 h-4 text-muted-foreground" />}>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Move className="w-4 h-4" />} label="Stabilitet" value={head.stabilityScore} unit="%" desc="Lav bevegelse = høy" status={head.stabilityScore > 60 ? "good" : head.stabilityScore > 30 ? "warn" : "bad"} />
        <MetricCard icon={<Activity className="w-4 h-4" />} label="Kompensasjon" value={head.compensatoryMovements} desc="Hodet erstatter øyebevegelse" status={head.compensatoryMovements < 10 ? "good" : head.compensatoryMovements < 30 ? "warn" : "bad"} />
      </div>
      <div className="space-y-2 text-sm">
        <DetailRow label="Total bevegelse" value={`${head.totalMovement} px`} />
        <DetailRow label="Snitt hastighet" value={`${head.avgSpeed} px/s`} />
        <DetailRow label="Maks tilt" value={`${head.maxTiltDeviation}°`} />
        <DetailRow label="Maks rotasjon" value={`${head.maxTurnDeviation}°`} />
        <DetailRow label="Maks nikk" value={`${head.maxNodDeviation}°`} />
      </div>
    </Section>
  );
}

function EyeHeadSection({ report }: { report: ClinicalReport }) {
  const { eyeHead } = report;
  return (
    <Section title="Øye-hode-koordinering" icon={<Brain className="w-4 h-4 text-muted-foreground" />} defaultOpen={false}>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Brain className="w-4 h-4" />} label="Koordinering" value={eyeHead.coordinationScore} unit="%" desc="Øynene leder bevegelsen" status={eyeHead.coordinationScore > 60 ? "good" : eyeHead.coordinationScore > 30 ? "warn" : "bad"} />
        <MetricCard icon={<Activity className="w-4 h-4" />} label="Kompensasjonsratio" value={eyeHead.compensatoryRatio} desc="Hode vs øyebevegelse" />
      </div>
      <div className="space-y-2 text-sm">
        <DetailRow label="Øyet leder" value={`${eyeHead.eyeLeadEvents} ganger`} />
        <DetailRow label="Hodet leder" value={`${eyeHead.headLeadEvents} ganger`} />
      </div>
    </Section>
  );
}

function AttentionSection({ report }: { report: ClinicalReport }) {
  const { attention } = report;
  return (
    <Section title="Oppmerksomhet" icon={<Eye className="w-4 h-4 text-muted-foreground" />} defaultOpen={false}>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Eye className="w-4 h-4" />} label="På oppgaven" value={attention.onTaskPercentage} unit="%" desc="Blikk innenfor oppgaveområdet" status={attention.onTaskPercentage > 70 ? "good" : attention.onTaskPercentage > 40 ? "warn" : "bad"} />
        <MetricCard icon={<AlertTriangle className="w-4 h-4" />} label="Utmattelse" value={attention.fatigueIndex} unit="%" desc="Forverring over tid" status={attention.fatigueIndex < 20 ? "good" : attention.fatigueIndex < 50 ? "warn" : "bad"} />
      </div>
      <div className="space-y-2 text-sm">
        <DetailRow label="Oppmerksomhetsbrudd" value={attention.attentionDrops} />
        <DetailRow label="Snitt avbruddslengde" value={`${attention.avgOffTaskDuration} ms`} />
        <DetailRow label="Lengste avbrudd" value={`${attention.longestOffTask} ms`} />
      </div>
    </Section>
  );
}

function TimelineChart({ report }: { report: ClinicalReport }) {
  const frames = report.frames;
  if (frames.length < 5) return null;

  const width = 600;
  const height = 80;
  const startTime = frames[0].timestamp;
  const endTime = frames[frames.length - 1].timestamp;
  const timeRange = endTime - startTime || 1;

  const toPath = (getValue: (f: typeof frames[0]) => number, yMin: number, yMax: number) => {
    const range = yMax - yMin || 1;
    return frames
      .map((f, i) => {
        const px = ((f.timestamp - startTime) / timeRange) * width;
        const py = height - ((getValue(f) - yMin) / range) * (height - 10) - 5;
        return `${i === 0 ? "M" : "L"}${px},${py}`;
      })
      .join(" ");
  };

  // Left vs right eye X
  const allEyeX = frames.flatMap(f => [f.leftEye.x, f.rightEye.x]);
  const minEyeX = Math.min(...allEyeX);
  const maxEyeX = Math.max(...allEyeX);

  // EAR over time
  const allEAR = frames.flatMap(f => [f.leftEAR, f.rightEAR]);
  const minEAR = Math.min(...allEAR);
  const maxEAR = Math.max(...allEAR);

  // PD over time
  const allPD = frames.map(f => f.pd);
  const minPD = Math.min(...allPD);
  const maxPD = Math.max(...allPD);

  const timeLabels = (
    <div className="flex justify-between mt-1">
      <span className="text-[10px] text-muted-foreground">0s</span>
      <span className="text-[10px] text-muted-foreground">{(timeRange / 1000).toFixed(1)}s</span>
    </div>
  );

  return (
    <Section title="Tidslinje" icon={<Activity className="w-4 h-4 text-muted-foreground" />} defaultOpen={false}>
      {/* Eye positions */}
      <div>
        <h3 className="text-xs font-medium text-foreground mb-1">Øyeposisjon (V/H)</h3>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
          <path d={toPath(f => f.leftEye.x, minEyeX, maxEyeX)} fill="none" stroke="hsl(221, 83%, 53%)" strokeWidth="1" />
          <path d={toPath(f => f.rightEye.x, minEyeX, maxEyeX)} fill="none" stroke="hsl(142, 76%, 36%)" strokeWidth="1" />
        </svg>
        {timeLabels}
        <div className="flex gap-3 mt-1">
          <span className="text-[10px] text-primary flex items-center gap-1"><span className="w-2 h-0.5 bg-primary inline-block" /> V</span>
          <span className="text-[10px] text-success flex items-center gap-1"><span className="w-2 h-0.5 bg-success inline-block" /> H</span>
        </div>
      </div>

      {/* EAR (blink detection) */}
      <div>
        <h3 className="text-xs font-medium text-foreground mb-1">Øyeåpning (EAR)</h3>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
          <path d={toPath(f => f.leftEAR, minEAR, maxEAR)} fill="none" stroke="hsl(221, 83%, 53%)" strokeWidth="1" />
          <path d={toPath(f => f.rightEAR, minEAR, maxEAR)} fill="none" stroke="hsl(142, 76%, 36%)" strokeWidth="1" />
          {/* Blink threshold line */}
          <line x1="0" y1={height - ((0.18 - minEAR) / (maxEAR - minEAR || 1)) * (height - 10) - 5} x2={width} y2={height - ((0.18 - minEAR) / (maxEAR - minEAR || 1)) * (height - 10) - 5} stroke="hsl(0, 84%, 60%)" strokeWidth="0.5" strokeDasharray="4,4" />
        </svg>
        {timeLabels}
        <div className="flex gap-3 mt-1">
          <span className="text-[10px] text-primary flex items-center gap-1"><span className="w-2 h-0.5 bg-primary inline-block" /> V</span>
          <span className="text-[10px] text-success flex items-center gap-1"><span className="w-2 h-0.5 bg-success inline-block" /> H</span>
          <span className="text-[10px] text-destructive flex items-center gap-1"><span className="w-2 h-px bg-destructive inline-block border-t border-dashed" /> Blunkterskel</span>
        </div>
      </div>

      {/* PD over time */}
      <div>
        <h3 className="text-xs font-medium text-foreground mb-1">Pupillavstand</h3>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
          <path d={toPath(f => f.pd, minPD, maxPD)} fill="none" stroke="hsl(35, 100%, 50%)" strokeWidth="1.5" />
        </svg>
        {timeLabels}
      </div>
    </Section>
  );
}

// ==================== Main component ====================

export default function ClinicalReportView({ report }: { report: ClinicalReport }) {
  return (
    <div className="space-y-3">
      {/* Flags (always visible) */}
      <FlagsBanner flags={report.flags} />

      {/* Session info */}
      <div className="card-surface p-4 space-y-2 text-sm">
        <DetailRow label="Oppgavetype" value={report.taskType === "reading" ? "Leseoppgave" : "Følgeoppgave"} />
        <DetailRow label="Varighet" value={`${(report.duration / 1000).toFixed(1)}s`} />
        <DetailRow label="Frames analysert" value={report.totalFrames} />
        <DetailRow label="FPS" value={report.fps} />
        <DetailRow label="Iris-data" value={report.gazeDirection.hasIrisData ? "Ja" : "Nei"} />
      </div>

      {/* Metric sections */}
      <BlinkSection report={report} />
      <FixationSection report={report} />
      <SaccadeSection report={report} />
      <VergenceSection report={report} />
      <HeadSection report={report} />
      <EyeHeadSection report={report} />
      <AttentionSection report={report} />
      <TimelineChart report={report} />
    </div>
  );
}

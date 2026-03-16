import { EyeSyncReport } from "@/lib/eye-tracking";
import { Eye, Activity, Ruler } from "lucide-react";

interface EyeSyncCardProps {
  report: EyeSyncReport;
}

function StatusBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  const status = value >= thresholds[1] ? "good" : value >= thresholds[0] ? "warn" : "bad";
  const color =
    status === "good" ? "text-success" : status === "warn" ? "text-orange-500" : "text-destructive";
  return <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}%</span>;
}

export default function EyeSyncCard({ report }: EyeSyncCardProps) {
  const ratioLabel =
    report.movementRatio > 0.85 && report.movementRatio < 1.15 ? "Symmetrisk" : "Asymmetrisk";
  const ratioStatus =
    report.movementRatio > 0.85 && report.movementRatio < 1.15 ? "text-success" : "text-destructive";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Eye className="w-4 h-4" />
        Øyesynkronitet
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {/* Sync score */}
        <div className="card-surface p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span className="text-xs">Synkronitet</span>
          </div>
          <StatusBadge value={report.syncScore} thresholds={[40, 70]} />
          <p className="text-xs text-muted-foreground">Hvor likt øynene beveger seg</p>
        </div>

        {/* Movement ratio */}
        <div className="card-surface p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Ruler className="w-4 h-4" />
            <span className="text-xs">Bevegelsesbalanse</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${ratioStatus}`}>{ratioLabel}</p>
          <p className="text-xs text-muted-foreground">
            V/H ratio: {report.movementRatio}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="card-surface p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pupillavstand (snitt)</span>
          <span className="font-medium text-foreground tabular-nums">{report.avgPD} px</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">PD-variasjon</span>
          <span className="font-medium text-foreground tabular-nums">±{report.pdVariation} px</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Konvergenshendelser</span>
          <span className="font-medium text-foreground tabular-nums">{report.convergenceEvents}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Målinger</span>
          <span className="font-medium text-foreground tabular-nums">{report.totalFrames} frames</span>
        </div>
      </div>

      {/* Eye movement chart */}
      <EyeMovementChart frames={report.eyeFrames} />
    </div>
  );
}

function EyeMovementChart({ frames }: { frames: { timestamp: number; leftX: number; rightX: number }[] }) {
  if (frames.length < 5) return null;

  const width = 600;
  const height = 100;
  const startTime = frames[0].timestamp;
  const endTime = frames[frames.length - 1].timestamp;
  const timeRange = endTime - startTime || 1;

  const allX = frames.flatMap(f => [f.leftX, f.rightX]);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const xRange = maxX - minX || 1;

  const toPath = (getValue: (f: typeof frames[0]) => number) => {
    return frames
      .map((f, i) => {
        const px = ((f.timestamp - startTime) / timeRange) * width;
        const py = height - ((getValue(f) - minX) / xRange) * (height - 10) - 5;
        return `${i === 0 ? "M" : "L"}${px},${py}`;
      })
      .join(" ");
  };

  return (
    <div className="card-surface p-4 space-y-2">
      <h3 className="text-xs font-medium text-foreground">Øyebevegelser (X-posisjon over tid)</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <path d={toPath(f => f.leftX)} fill="none" stroke="hsl(221, 83%, 53%)" strokeWidth="1.5" />
        <path d={toPath(f => f.rightX)} fill="none" stroke="hsl(142, 76%, 36%)" strokeWidth="1.5" />
      </svg>
      <div className="flex gap-4">
        <span className="text-[10px] text-primary flex items-center gap-1">
          <span className="w-3 h-0.5 bg-primary inline-block" /> Venstre øye
        </span>
        <span className="text-[10px] text-success flex items-center gap-1">
          <span className="w-3 h-0.5 bg-success inline-block" /> Høyre øye
        </span>
      </div>
    </div>
  );
}

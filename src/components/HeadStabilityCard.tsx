import { HeadStabilityReport, HeadFrame } from "@/lib/eye-tracking";
import { Move, RotateCcw, ArrowUpDown } from "lucide-react";

interface HeadStabilityCardProps {
  report: HeadStabilityReport;
}

export default function HeadStabilityCard({ report }: HeadStabilityCardProps) {
  const stabilityLabel =
    report.stabilityScore >= 70 ? "Stabilt" : report.stabilityScore >= 40 ? "Moderat" : "Urolig";
  const stabilityColor =
    report.stabilityScore >= 70
      ? "text-success"
      : report.stabilityScore >= 40
      ? "text-orange-500"
      : "text-destructive";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Move className="w-4 h-4" />
        Hodestabilitet
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-surface p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Move className="w-4 h-4" />
            <span className="text-xs">Stabilitet</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${stabilityColor}`}>
            {report.stabilityScore}%
          </p>
          <p className="text-xs text-muted-foreground">{stabilityLabel} hode</p>
        </div>

        <div className="card-surface p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ArrowUpDown className="w-4 h-4" />
            <span className="text-xs">Hastighet</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {report.avgSpeed} <span className="text-sm font-normal">px/s</span>
          </p>
          <p className="text-xs text-muted-foreground">Snitt hodebevegelse</p>
        </div>
      </div>

      <div className="card-surface p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total bevegelse</span>
          <span className="font-medium text-foreground tabular-nums">{report.totalMovement} px</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Maks tilt (sidelengs)</span>
          <span className="font-medium text-foreground tabular-nums">{report.maxTilt}°</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Maks rotasjon (vri)</span>
          <span className="font-medium text-foreground tabular-nums">{report.maxTurn}°</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Maks nikk (opp/ned)</span>
          <span className="font-medium text-foreground tabular-nums">{report.maxNod}°</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Målinger</span>
          <span className="font-medium text-foreground tabular-nums">{report.totalFrames} frames</span>
        </div>
      </div>

      <HeadMovementChart frames={report.headFrames} />
    </div>
  );
}

function HeadMovementChart({ frames }: { frames: HeadFrame[] }) {
  if (frames.length < 5) return null;

  const width = 600;
  const height = 100;
  const startTime = frames[0].timestamp;
  const endTime = frames[frames.length - 1].timestamp;
  const timeRange = endTime - startTime || 1;

  // Show X position over time (horizontal head movement)
  const xs = frames.map(f => f.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xRange = maxX - minX || 1;

  const pathD = frames
    .map((f, i) => {
      const px = ((f.timestamp - startTime) / timeRange) * width;
      const py = height - ((f.x - minX) / xRange) * (height - 10) - 5;
      return `${i === 0 ? "M" : "L"}${px},${py}`;
    })
    .join(" ");

  return (
    <div className="card-surface p-4 space-y-2">
      <h3 className="text-xs font-medium text-foreground">Hodeposisjon (X over tid)</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="hsl(35, 100%, 50%)" strokeWidth="1.5" />
      </svg>
      <div className="flex gap-4">
        <span className="text-[10px] text-orange-500 flex items-center gap-1">
          <span className="w-3 h-0.5 bg-orange-500 inline-block" /> Hodeposisjon
        </span>
      </div>
    </div>
  );
}

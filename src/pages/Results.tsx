import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SessionReport, exportToJSON, exportToCSV } from "@/lib/gaze-store";
import { EyeSyncReport } from "@/lib/eye-tracking";
import EyeSyncCard from "@/components/EyeSyncCard";
import { ArrowLeft, Download, Eye, Activity, BarChart3, AlertTriangle } from "lucide-react";

const Results = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState<SessionReport | null>(null);
  const [eyeSync, setEyeSync] = useState<EyeSyncReport | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("lastReport");
    if (stored) setReport(JSON.parse(stored));
    const storedEye = sessionStorage.getItem("lastEyeSync");
    if (storedEye) setEyeSync(JSON.parse(storedEye));
  }, []);

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([exportToJSON(report)], { type: "application/json" });
    downloadBlob(blob, `bedre-blikk-${report.session.id}.json`);
  };

  const handleExportCSV = () => {
    if (!report) return;
    const blob = new Blob([exportToCSV(report)], { type: "text/csv" });
    downloadBlob(blob, `bedre-blikk-${report.session.id}.csv`);
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Ingen data funnet</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Tilbake
          </Button>
        </div>
      </div>
    );
  }

  const taskLabel = report.session.type === "reading" ? "Leseoppgave" : "Følgeoppgave";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-clinical"
          >
            <ArrowLeft className="w-4 h-4" />
            Ny økt
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(report.session.startTime).toLocaleString("no-NO")}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Rapport</h1>
          <p className="text-sm text-muted-foreground mt-1">{taskLabel} — {formatDuration(report.totalDuration)}</p>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard
            icon={<Eye className="w-4 h-4" />}
            label="Fokus"
            value={`${Math.round(report.onTaskPercentage)}%`}
            desc="Blikk på oppgaven"
            status={report.onTaskPercentage > 70 ? "good" : report.onTaskPercentage > 40 ? "warn" : "bad"}
          />
          <ScoreCard
            icon={<Activity className="w-4 h-4" />}
            label="Glatthetscore"
            value={`${report.smoothnessScore}%`}
            desc="Jevnhet i bevegelser"
            status={report.smoothnessScore > 60 ? "good" : report.smoothnessScore > 30 ? "warn" : "bad"}
          />
          <ScoreCard
            icon={<BarChart3 className="w-4 h-4" />}
            label="Sakkader"
            value={`${report.saccadeCount}`}
            desc="Raske øyehopp"
          />
          <ScoreCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Regresjoner"
            value={`${report.regressionCount}`}
            desc="Tilbakehopp"
            status={report.regressionCount > 10 ? "bad" : report.regressionCount > 5 ? "warn" : "good"}
          />
        </div>

        {/* Details */}
        <div className="card-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Detaljer</h2>
          <div className="space-y-2 text-sm">
            <DetailRow label="Totale blikkpunkter" value={report.totalGazePoints.toLocaleString()} />
            <DetailRow label="Gj.snitt fikseringsvarighet" value={`${report.avgFixationDuration} ms`} />
            <DetailRow label="Varighet" value={formatDuration(report.totalDuration)} />
            <DetailRow label="Oppgavetype" value={taskLabel} />
          </div>
        </div>

        {/* Gaze trajectory visualization */}
        <div className="card-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Blikkbane (X over tid)</h2>
          <GazeChart report={report} />
        </div>

        {/* Export */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExportJSON} className="flex-1 gap-2">
            <Download className="w-4 h-4" />
            JSON
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="flex-1 gap-2">
            <Download className="w-4 h-4" />
            CSV
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Denne rapporten er kun til screening og forskning. Ikke bruk som medisinsk diagnose.
        </p>
      </div>
    </div>
  );
};

function ScoreCard({
  icon,
  label,
  value,
  desc,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  desc: string;
  status?: "good" | "warn" | "bad";
}) {
  const statusColor =
    status === "good"
      ? "text-success"
      : status === "warn"
      ? "text-orange-500"
      : status === "bad"
      ? "text-destructive"
      : "text-foreground";

  return (
    <div className="card-surface p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${statusColor}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function GazeChart({ report }: { report: SessionReport }) {
  const points = report.session.gazePoints;
  if (points.length < 2) {
    return <p className="text-xs text-muted-foreground">For lite data til å vise graf</p>;
  }

  const width = 600;
  const height = 120;
  const startTime = points[0].timestamp;
  const endTime = points[points.length - 1].timestamp;
  const timeRange = endTime - startTime || 1;
  const maxX = Math.max(...points.map((p) => p.x), 1);

  // Build SVG path
  const pathPoints = points.map((p) => {
    const px = ((p.timestamp - startTime) / timeRange) * width;
    const py = height - (p.x / maxX) * (height - 10) - 5;
    return `${px},${py}`;
  });

  // Highlight regressions (backward jumps)
  const regressionSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    if (dx < -80) {
      const x1 = ((points[i - 1].timestamp - startTime) / timeRange) * width;
      const y1 = height - (points[i - 1].x / maxX) * (height - 10) - 5;
      const x2 = ((points[i].timestamp - startTime) / timeRange) * width;
      const y2 = height - (points[i].x / maxX) * (height - 10) - 5;
      regressionSegments.push({ x1, y1, x2, y2 });
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none">
        <polyline
          points={pathPoints.join(" ")}
          fill="none"
          stroke="hsl(221, 83%, 53%)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {regressionSegments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="hsl(0, 84%, 60%)"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">0s</span>
        <span className="text-[10px] text-muted-foreground">{(timeRange / 1000).toFixed(1)}s</span>
      </div>
      <div className="flex gap-4 mt-2">
        <span className="text-[10px] text-primary flex items-center gap-1">
          <span className="w-3 h-0.5 bg-primary inline-block" /> X-posisjon
        </span>
        <span className="text-[10px] text-destructive flex items-center gap-1">
          <span className="w-3 h-0.5 bg-destructive inline-block" /> Regresjoner
        </span>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export default Results;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClinicalReport } from "@/lib/session-analyzer";
import ClinicalReportView from "@/components/ClinicalReportView";
import { ArrowLeft, Download } from "lucide-react";

const Results = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState<ClinicalReport | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("clinicalReport");
    if (stored) {
      try {
        setReport(JSON.parse(stored));
      } catch {
        // invalid data
      }
    }
  }, []);

  const handleExportJSON = () => {
    if (!report) return;
    // Strip raw frames for export (too large)
    const exportData = { ...report, frames: `[${report.frames.length} frames omitted]` };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    downloadBlob(blob, `klinisk-rapport-${report.sessionId}.json`);
  };

  const handleExportFullJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, `klinisk-rapport-full-${report.sessionId}.json`);
  };

  const handleExportCSV = () => {
    if (!report) return;
    const headers = ["timestamp", "leftEyeX", "leftEyeY", "rightEyeX", "rightEyeY", "leftEAR", "rightEAR", "pd", "headX", "headY", "headTilt", "headTurn", "headNod", "leftBlink", "rightBlink"];
    const rows = report.frames.map(f =>
      [f.timestamp, f.leftEye.x.toFixed(1), f.leftEye.y.toFixed(1), f.rightEye.x.toFixed(1), f.rightEye.y.toFixed(1), f.leftEAR.toFixed(3), f.rightEAR.toFixed(3), f.pd.toFixed(1), f.headX.toFixed(1), f.headY.toFixed(1), f.headTilt, f.headTurn, f.headNod, f.leftBlink ? 1 : 0, f.rightBlink ? 1 : 0].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    downloadBlob(blob, `klinisk-data-${report.sessionId}.csv`);
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Ingen data funnet</p>
          <Button variant="outline" onClick={() => navigate("/")}>Tilbake</Button>
        </div>
      </div>
    );
  }

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
            {new Date(report.frames[0]?.timestamp || Date.now()).toLocaleString("no-NO")}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Klinisk rapport</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {report.taskType === "reading" ? "Leseoppgave" : "Følgeoppgave"} — {(report.duration / 1000).toFixed(1)}s — {report.totalFrames} frames
          </p>
        </div>

        {/* Clinical report */}
        <ClinicalReportView report={report} />

        {/* Export */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Eksporter</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExportJSON} className="flex-1 gap-2">
              <Download className="w-4 h-4" />
              Rapport (JSON)
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="flex-1 gap-2">
              <Download className="w-4 h-4" />
              Rådata (CSV)
            </Button>
          </div>
          <Button variant="ghost" onClick={handleExportFullJSON} className="w-full text-xs text-muted-foreground">
            Eksporter med alle frames (stor fil)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pb-4">
          Denne rapporten er kun til screening og forskning. Ikke bruk som medisinsk diagnose.
        </p>
      </div>
    </div>
  );
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default Results;

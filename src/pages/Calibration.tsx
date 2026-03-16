import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { initDetector, isDetectorReady, getDetectorError, startDetection, stopDetection } from "@/lib/face-detector";

function toUserError(rawError: string | null): string {
  if (!rawError) return "Kunne ikke starte ansiktsgjenkjenning på denne enheten/nettleseren.";
  const e = rawError.toLowerCase();
  if (e.includes("notallowed") || e.includes("permission") || e.includes("denied"))
    return "Kameratilgang ble avvist. Tillat kamera i nettleseren og prøv igjen.";
  if (e.includes("notfound") || e.includes("no camera") || e.includes("could not start video source"))
    return "Fant ikke tilgjengelig kamera på denne enheten.";
  if (e.includes("network") || e.includes("404") || e.includes("failed to fetch") || e.includes("abort"))
    return "Kunne ikke laste ansiktsmodellen. Prøv å laste siden på nytt.";
  return "Kunne ikke starte ansiktsgjenkjenning på denne enheten/nettleseren.";
}

const Calibration = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "verifying" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const frameCountRef = useRef(0);

  const handleStart = useCallback(async () => {
    setStatus("loading");
    setError(null);
    const ok = isDetectorReady() ? true : await initDetector();
    if (!ok) {
      setStatus("error");
      setError(toUserError(getDetectorError()));
      return;
    }
    setStatus("verifying");
    frameCountRef.current = 0;
    setFrameCount(0);
    startDetection(() => {
      frameCountRef.current += 1;
      setFrameCount(frameCountRef.current);
    });
  }, []);

  useEffect(() => {
    if (status !== "verifying" || frameCount < 15) return;
    setStatus("done");
    stopDetection();
    const timer = setTimeout(() => navigate("/task-select"), 800);
    return () => clearTimeout(timer);
  }, [status, frameCount, navigate]);

  return (
    <div className="fixed inset-0 bg-background">
      <div className="h-full flex items-center justify-center px-6">
        <div className="card-surface p-6 w-full max-w-md text-center space-y-4">
          <h1 className="text-lg font-semibold text-foreground">Ansiktsgjenkjenning</h1>

          {status === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">
                Se rett på kameraet mens vi verifiserer ansiktsgjenkjenning.
              </p>
              <Button onClick={handleStart} className="w-full">Start</Button>
            </>
          )}

          {status === "loading" && (
            <div className="space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Laster ansiktsmodell...</p>
            </div>
          )}

          {status === "verifying" && (
            <div className="space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Verifiserer ansiktsgjenkjenning...</p>
              <p className="text-xs text-muted-foreground">Se rett på kameraet</p>
              <p className="text-xs text-muted-foreground tabular-nums">{frameCount} / 15 frames</p>
            </div>
          )}

          {status === "done" && (
            <p className="text-sm text-success font-medium">Ansiktsgjenkjenning verifisert ✓</p>
          )}

          {status === "error" && (
            <>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleStart} className="w-full">Prøv igjen</Button>
              <Button variant="outline" onClick={() => navigate("/task-select")} className="w-full">
                Fortsett uten ansiktsgjenkjenning
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calibration;

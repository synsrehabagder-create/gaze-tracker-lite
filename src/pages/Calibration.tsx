import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { initWebGazer, isWebGazerReady, getWebGazer } from "@/lib/webgazer-loader";

const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.5, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

const Calibration = () => {
  const navigate = useNavigate();
  const [currentPoint, setCurrentPoint] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "calibrating" | "done" | "error">("idle");
  const [hitPoints, setHitPoints] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const CLICKS_PER_POINT = 3;

  const startTracking = useCallback(async () => {
    setStatus("loading");
    setError(null);

    const ok = isWebGazerReady() ? true : await initWebGazer();

    if (!ok) {
      setStatus("error");
      setError("Kunne ikke starte blikksporing på denne enheten/nettleseren.");
      return;
    }

    setStatus("calibrating");
  }, []);

  const handlePointClick = useCallback(
    (index: number) => {
      if (index !== currentPoint) return;

      const newCount = clickCount + 1;
      setClickCount(newCount);

      const point = CALIBRATION_POINTS[index];
      const x = point.x * window.innerWidth;
      const y = point.y * window.innerHeight;

      try {
        getWebGazer().recordScreenPosition(x, y, "click");
      } catch (e) {
        console.warn("recordScreenPosition failed", e);
      }

      if (newCount >= CLICKS_PER_POINT) {
        const newHit = new Set(hitPoints);
        newHit.add(index);
        setHitPoints(newHit);

        if (index < CALIBRATION_POINTS.length - 1) {
          setCurrentPoint(index + 1);
          setClickCount(0);
        } else {
          setStatus("done");
          setTimeout(() => navigate("/task-select"), 800);
        }
      }
    },
    [currentPoint, clickCount, hitPoints, navigate]
  );

  return (
    <div className="fixed inset-0 bg-background">
      {(status === "idle" || status === "loading" || status === "error") && (
        <div className="h-full flex items-center justify-center px-6">
          <div className="card-surface p-6 w-full max-w-md text-center space-y-4">
            <h1 className="text-lg font-semibold text-foreground">Kalibrering</h1>
            <p className="text-sm text-muted-foreground">
              Trykk for å starte blikksporing, og klikk deretter på punktene.
            </p>

            {status === "loading" && (
              <div className="space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Laster blikksporing…</p>
              </div>
            )}

            {status === "error" && error && <p className="text-sm text-destructive">{error}</p>}

            {status !== "loading" && (
              <Button onClick={startTracking} className="w-full">
                Start blikksporing
              </Button>
            )}

            {status === "error" && (
              <Button variant="outline" onClick={() => navigate("/task-select")} className="w-full">
                Fortsett uten blikksporing
              </Button>
            )}
          </div>
        </div>
      )}

      {status === "calibrating" && (
        <>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
            <p className="text-sm text-muted-foreground tabular-nums">
              Punkt {currentPoint + 1} av {CALIBRATION_POINTS.length} — klikk {CLICKS_PER_POINT - clickCount} ganger
            </p>
          </div>

          {CALIBRATION_POINTS.map((point, index) => {
            const isActive = index === currentPoint;
            const isHit = hitPoints.has(index);
            const isFuture = index > currentPoint;

            return (
              <button
                key={index}
                onClick={() => handlePointClick(index)}
                className="absolute transition-clinical"
                style={{
                  left: `${point.x * 100}%`,
                  top: `${point.y * 100}%`,
                  transform: `translate(-50%, -50%) scale(${isHit ? 0.8 : 1})`,
                }}
              >
                <div
                  className={`w-6 h-6 rounded-full transition-clinical ${
                    isHit ? "bg-success" : isActive ? "bg-primary animate-pulse-soft" : isFuture ? "bg-muted" : "bg-muted"
                  }`}
                />
              </button>
            );
          })}
        </>
      )}

      {status === "done" && (
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-success font-medium">Kalibrering fullført ✓</p>
        </div>
      )}
    </div>
  );
};

export default Calibration;

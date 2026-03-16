import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loadWebGazer } from "@/lib/webgazer-loader";

// 9-point calibration grid positions (normalized 0-1)
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
  const [status, setStatus] = useState<"loading" | "calibrating" | "done">("loading");
  const [hitPoints, setHitPoints] = useState<Set<number>>(new Set());
  const CLICKS_PER_POINT = 3;

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const webgazer = await loadWebGazer();
        webgazer
          .setRegression("ridge")
          .setGazeListener(() => {})
          .showPredictionPoints(false);

        // Hide WebGazer's default video
        await webgazer.begin();

        const videoEl = document.getElementById("webgazerVideoFeed") as HTMLVideoElement;
        if (videoEl) videoEl.style.display = "none";
        const videoContainer = document.getElementById("webgazerVideoContainer");
        if (videoContainer) videoContainer.style.display = "none";
        const faceOverlay = document.getElementById("webgazerFaceOverlay");
        if (faceOverlay) faceOverlay.style.display = "none";
        const faceFeedbackBox = document.getElementById("webgazerFaceFeedbackBox");
        if (faceFeedbackBox) faceFeedbackBox.style.display = "none";

        if (mounted) setStatus("calibrating");
      } catch (err) {
        console.error("WebGazer init failed:", err);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePointClick = useCallback(
    (index: number) => {
      if (index !== currentPoint) return;

      const newCount = clickCount + 1;
      setClickCount(newCount);

      // Feed click to WebGazer for calibration
      const point = CALIBRATION_POINTS[index];
      const x = point.x * window.innerWidth;
      const y = point.y * window.innerHeight;
      (window as any).webgazer?.recordScreenPosition(x, y, "click");

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
      {status === "loading" && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Laster blikksporing…</p>
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
                    isHit
                      ? "bg-success"
                      : isActive
                      ? "bg-primary animate-pulse-soft"
                      : isFuture
                      ? "bg-muted"
                      : "bg-muted"
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

import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getWebGazer, initWebGazer, stopWebGazer } from "@/lib/webgazer-loader";
import { startSession, addGazePoint, endSession, setTaskAreaBounds, analyzeSession } from "@/lib/gaze-store";
import { startEyeTracking, stopEyeTracking, analyzeEyeSync } from "@/lib/eye-tracking";

const DURATION = 15000;

const PursuitTask = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"countdown" | "tracking" | "done">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [dotPos, setDotPos] = useState({ x: 50, y: 50 });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("tracking");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  const handleDone = useCallback(() => {
    setPhase("done");
    const eyeFrames = stopEyeTracking();
    const session = endSession();

    stopWebGazer();

    if (session) {
      const report = analyzeSession(session);
      const eyeSync = analyzeEyeSync(eyeFrames);
      sessionStorage.setItem("lastReport", JSON.stringify(report));
      if (eyeSync) sessionStorage.setItem("lastEyeSync", JSON.stringify(eyeSync));
      navigate("/results");
    }
  }, [navigate]);

  useEffect(() => {
    if (phase !== "tracking") return;

    startSession("pursuit");

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTaskAreaBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }

    const startTracking = async () => {
      const ok = await initWebGazer();
      if (!ok) return;

      try {
        const wg = getWebGazer();
        wg.setGazeListener((data: any) => {
          if (data) addGazePoint(data.x, data.y);
        });
      } catch (e) {
        console.warn("WebGazer gaze listener error", e);
      }
    };

    void startTracking();

    const startTime = Date.now();
    const interval = setInterval(() => {
      const t = Date.now() - startTime;
      setElapsed(t);

      if (t >= DURATION) {
        clearInterval(interval);
        handleDone();
        return;
      }

      const progress = t / DURATION;
      const cycles = 2;
      const p = (progress * cycles * 2) % 2;
      const x = p <= 1 ? p : 2 - p;
      const y = 0.5 + Math.sin(progress * Math.PI * 4) * 0.15;

      setDotPos({ x: 10 + x * 80, y: 10 + y * 80 });
    }, 16);

    return () => {
      clearInterval(interval);
      try { getWebGazer().setGazeListener(() => {}); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-background flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between z-10">
        <span className="text-xs text-muted-foreground">Følgeoppgave</span>
        {phase === "tracking" && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.max(0, Math.ceil((DURATION - elapsed) / 1000))}s
          </span>
        )}
      </div>

      <div className="flex-1 relative">
        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-6xl font-bold text-primary tabular-nums">{countdown || "Følg!"}</p>
              <p className="text-sm text-muted-foreground mt-3">Følg prikken med øynene</p>
            </div>
          </div>
        )}

        {phase === "tracking" && (
          <div
            className="absolute w-6 h-6 rounded-full bg-primary"
            style={{
              left: `${dotPos.x}%`,
              top: `${dotPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PursuitTask;

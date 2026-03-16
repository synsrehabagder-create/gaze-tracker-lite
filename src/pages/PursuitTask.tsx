import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { startSession, addGazePoint, endSession, setTaskAreaBounds, analyzeSession } from "@/lib/gaze-store";

const DURATION = 15000; // 15 seconds

const PursuitTask = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"countdown" | "tracking" | "done">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [dotPos, setDotPos] = useState({ x: 50, y: 50 });
  const [elapsed, setElapsed] = useState(0);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("tracking");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  // Dot movement — smooth horizontal and slight vertical wave
  useEffect(() => {
    if (phase !== "tracking") return;

    startSession("pursuit");

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTaskAreaBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }

    const webgazer = (window as any).webgazer;
    if (webgazer) {
      webgazer.setGazeListener((data: any) => {
        if (data) addGazePoint(data.x, data.y);
      });
    }

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
      // Horizontal sweep back and forth
      const cycles = 2;
      const phase2 = (progress * cycles * 2) % 2;
      const x = phase2 <= 1 ? phase2 : 2 - phase2;
      // Gentle vertical wave
      const y = 0.5 + Math.sin(progress * Math.PI * 4) * 0.15;

      setDotPos({ x: 10 + x * 80, y: 10 + y * 80 });
    }, 16);

    return () => {
      clearInterval(interval);
      if (webgazer) webgazer.setGazeListener(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleDone = useCallback(() => {
    setPhase("done");
    const session = endSession();

    const webgazer = (window as any).webgazer;
    if (webgazer) {
      webgazer.setGazeListener(() => {});
      webgazer.end();
    }

    if (session) {
      const report = analyzeSession(session);
      sessionStorage.setItem("lastReport", JSON.stringify(report));
      navigate("/results");
    }
  }, [navigate]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between z-10">
        <span className="text-xs text-muted-foreground">Følgeoppgave</span>
        {phase === "tracking" && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.max(0, Math.ceil((DURATION - elapsed) / 1000))}s
          </span>
        )}
      </div>

      {/* Content */}
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
            className="absolute w-6 h-6 rounded-full bg-primary transition-all"
            style={{
              left: `${dotPos.x}%`,
              top: `${dotPos.y}%`,
              transform: "translate(-50%, -50%)",
              transitionDuration: "16ms",
              transitionTimingFunction: "linear",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PursuitTask;

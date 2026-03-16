import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { startSession, addGazePoint, endSession, setTaskAreaBounds, analyzeSession } from "@/lib/gaze-store";

const READING_TEXT = `Solen skinte over de grønne åsene da Emma og hunden hennes, Buster, gikk ut på tur. De fulgte stien langs elven, der vannet rant stille mellom steinene. Buster stoppet for å snuse på en blomst. Emma lo og klappet ham på hodet.

De kom til en liten bro av tre. Emma så ned i vannet og kunne se fisker som svømte i sirkler. Hun telte dem: en, to, tre, fire, fem. Buster bjeffer mot en and som lå på vannet.

Etter en lang tur satte de seg under et stort eiketre. Emma tok frem matpakken sin og delte et stykke brød med Buster. Fuglene sang i trærne over dem. Det var en fin dag.`;

const ReadingTask = () => {
  const navigate = useNavigate();
  const taskAreaRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState<"countdown" | "reading" | "done">("countdown");

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("reading");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  // Start gaze tracking when reading begins
  useEffect(() => {
    if (phase !== "reading") return;

    startSession("reading");
    setIsRunning(true);

    // Set task area bounds
    if (taskAreaRef.current) {
      const rect = taskAreaRef.current.getBoundingClientRect();
      setTaskAreaBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }

    // Listen to WebGazer
    const webgazer = (window as any).webgazer;
    if (webgazer) {
      webgazer.setGazeListener((data: any) => {
        if (data) {
          addGazePoint(data.x, data.y);
        }
      });
    }

    return () => {
      if (webgazer) {
        webgazer.setGazeListener(() => {});
      }
    };
  }, [phase]);

  const handleDone = useCallback(() => {
    setIsRunning(false);
    setPhase("done");
    const session = endSession();

    // Stop WebGazer
    const webgazer = (window as any).webgazer;
    if (webgazer) {
      webgazer.setGazeListener(() => {});
      webgazer.end();
    }

    if (session) {
      const report = analyzeSession(session);
      // Store in sessionStorage for results page
      sessionStorage.setItem("lastReport", JSON.stringify(report));
      navigate("/results");
    }
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Minimal header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Leseoppgave</span>
        {phase === "reading" && (
          <button
            onClick={handleDone}
            className="text-sm text-primary font-medium hover:underline"
          >
            Ferdig
          </button>
        )}
      </div>

      {/* Task area — fixed aspect ratio */}
      <div className="flex-1 flex items-center justify-center px-6 pb-8">
        {phase === "countdown" && (
          <div className="text-center">
            <p className="text-6xl font-bold text-primary tabular-nums">{countdown || "Les!"}</p>
            <p className="text-sm text-muted-foreground mt-3">Forbered deg på å lese teksten</p>
          </div>
        )}

        {phase === "reading" && (
          <div className="max-w-2xl w-full">
            <div
              ref={taskAreaRef}
              className="card-surface p-8 sm:p-12"
              style={{ aspectRatio: "4/3", display: "flex", alignItems: "center" }}
            >
              <div className="text-reading text-foreground whitespace-pre-line">
                {READING_TEXT}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Side 1 av 1 — Trykk «Ferdig» når teksten er lest
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadingTask;

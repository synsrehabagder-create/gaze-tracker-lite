import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getWebGazer, initWebGazer, stopWebGazer } from "@/lib/webgazer-loader";
import { startTracking, stopTracking, setTrackingBounds } from "@/lib/tracker";

const READING_TEXT = `Solen skinte over de grønne åsene da Emma og hunden hennes, Buster, gikk ut på tur. De fulgte stien langs elven, der vannet rant stille mellom steinene. Buster stoppet for å snuse på en blomst. Emma lo og klappet ham på hodet.

De kom til en liten bro av tre. Emma så ned i vannet og kunne se fisker som svømte i sirkler. Hun telte dem: en, to, tre, fire, fem. Buster bjeffer mot en and som lå på vannet.

Etter en lang tur satte de seg under et stort eiketre. Emma tok frem matpakken sin og delte et stykke brød med Buster. Fuglene sang i trærne over dem. Det var en fin dag.`;

const ReadingTask = () => {
  const navigate = useNavigate();
  const taskAreaRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState<"countdown" | "reading" | "done">("countdown");

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("reading");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== "reading") return;

    let cancelled = false;
    const sessionId = crypto.randomUUID();

    if (taskAreaRef.current) {
      const rect = taskAreaRef.current.getBoundingClientRect();
      setTrackingBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }

    const begin = async () => {
      const ok = await initWebGazer();
      if (!ok || cancelled) return;

      try {
        const wg = getWebGazer();
        startTracking(wg, "reading", sessionId);
      } catch (e) {
        console.warn("Tracking start error", e);
      }
    };

    void begin();

    return () => {
      cancelled = true;
    };
  }, [phase]);

  const handleDone = useCallback(() => {
    setPhase("done");
    const report = stopTracking();
    stopWebGazer();

    if (report) {
      sessionStorage.setItem("clinicalReport", JSON.stringify(report));
      navigate("/results");
    }
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Leseoppgave</span>
        {phase === "reading" && (
          <button onClick={handleDone} className="text-sm text-primary font-medium hover:underline">
            Ferdig
          </button>
        )}
      </div>

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
              <div className="text-reading text-foreground whitespace-pre-line">{READING_TEXT}</div>
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

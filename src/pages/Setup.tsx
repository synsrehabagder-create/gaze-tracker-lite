import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";

type SetupStep = "permission" | "lighting" | "ready";

const Setup = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState<SetupStep>("permission");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lightingOk, setLightingOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream);
      setStep("lighting");
      setError(null);
    } catch {
      setError("Kunne ikke få tilgang til kameraet. Sjekk tillatelser.");
    }
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      // Don't stop the stream here, we'll need it for calibration
    };
  }, [stream]);

  // Simple brightness check
  useEffect(() => {
    if (step !== "lighting" || !videoRef.current) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !ctx || video.readyState < 2) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 16) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 16);

      setLightingOk(avgBrightness > 60 && avgBrightness < 230);
    }, 500);

    return () => clearInterval(interval);
  }, [step]);

  const handleContinue = () => {
    // Stop stream — face-detector will start its own
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    navigate("/calibration");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full space-y-6">
        <button
          onClick={() => {
            if (stream) stream.getTracks().forEach((t) => t.stop());
            navigate("/");
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-clinical"
        >
          <ArrowLeft className="w-4 h-4" />
          Tilbake
        </button>

        <h1 className="text-2xl font-bold text-foreground">Klargjør kamera</h1>

        {step === "permission" && (
          <div className="space-y-4">
            <div className="card-surface p-8 flex flex-col items-center gap-4 text-center">
              <Camera className="w-12 h-12 text-primary" />
              <p className="text-sm text-muted-foreground">
                Vi trenger tilgang til kameraet for å spore øyebevegelser. Ingen video lagres.
              </p>
              <Button onClick={requestCamera} className="w-full">
                Gi kameratilgang
              </Button>
              {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {step === "lighting" && (
          <div className="space-y-4">
            <div className="card-surface overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover bg-foreground/5"
              />
            </div>

            <div
              className={`card-surface p-4 flex items-center gap-3 transition-clinical ${
                !lightingOk ? "bg-warning" : ""
              }`}
            >
              {lightingOk ? (
                <>
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Belysning OK</p>
                    <p className="text-xs text-muted-foreground">Ansiktet er godt synlig</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Sjekk belysning</p>
                    <p className="text-xs text-muted-foreground">
                      Sørg for godt lys på ansiktet uten motlys
                    </p>
                  </div>
                </>
              )}
            </div>

            <Button
              onClick={handleContinue}
              className="w-full"
              disabled={!lightingOk}
            >
              Fortsett til kalibrering
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;

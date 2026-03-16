import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, Activity, ArrowLeft } from "lucide-react";

const TaskSelect = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full space-y-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-clinical"
        >
          <ArrowLeft className="w-4 h-4" />
          Avbryt
        </button>

        <h1 className="text-2xl font-bold text-foreground">Velg oppgave</h1>
        <p className="text-sm text-muted-foreground">
          Kalibrering er fullført. Velg hvilken oppgave som skal gjennomføres.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate("/reading-task")}
            className="card-surface p-5 w-full text-left flex items-start gap-4 hover:shadow-md transition-clinical"
          >
            <BookOpen className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Leseoppgave</p>
              <p className="text-sm text-muted-foreground mt-1">
                Barnet leser en kort tekst. Blikket spores for å måle sakkader, regresjoner og lesemønster.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate("/pursuit-task")}
            className="card-surface p-5 w-full text-left flex items-start gap-4 hover:shadow-md transition-clinical"
          >
            <Activity className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Følgeoppgave</p>
              <p className="text-sm text-muted-foreground mt-1">
                En prikk beveger seg over skjermen. Barnet følger prikken med blikket for å måle smooth pursuit.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskSelect;

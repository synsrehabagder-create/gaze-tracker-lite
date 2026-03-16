import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eye, BookOpen, Activity, BarChart3 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-6 h-6 text-primary" />
          <span className="text-lg font-semibold text-foreground">Bedre Blikk</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">MVP v1.0</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Blikksporing for leseforskning
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
              Mål øyebevegelser med webkamera. Samle data om sakkader, følgebevegelser og lesemønstre hos barn.
            </p>
          </div>

          <Button
            size="lg"
            className="px-8 h-12 text-base"
            onClick={() => navigate("/setup")}
          >
            Start økt
          </Button>

          {/* Feature cards */}
          <div className="grid grid-cols-3 gap-3 pt-8">
            <FeatureCard
              icon={<BookOpen className="w-5 h-5" />}
              title="Leseoppgave"
              desc="Mål sakkader og regresjoner"
            />
            <FeatureCard
              icon={<Activity className="w-5 h-5" />}
              title="Følgeoppgave"
              desc="Smooth pursuit tracking"
            />
            <FeatureCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Rapport"
              desc="Score og dataeksport"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Ikke medisinsk utstyr. Brukes til screening, trening og forskning.
        </p>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card-surface p-4 space-y-2 text-left">
      <div className="text-primary">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
    </div>
  );
}

export default Index;

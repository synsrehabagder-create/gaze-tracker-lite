import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Setup from "./pages/Setup.tsx";
import Calibration from "./pages/Calibration.tsx";
import TaskSelect from "./pages/TaskSelect.tsx";
import ReadingTask from "./pages/ReadingTask.tsx";
import PursuitTask from "./pages/PursuitTask.tsx";
import Results from "./pages/Results.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/task-select" element={<TaskSelect />} />
          <Route path="/reading-task" element={<ReadingTask />} />
          <Route path="/pursuit-task" element={<PursuitTask />} />
          <Route path="/results" element={<Results />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAnalysisStore } from "@/hooks/useAnalysis";
import { useAuthStore } from "@/store/useAuthStore";

const WS_BASE_URL =
  (import.meta as any).env.VITE_API_URL || "http://localhost:5000";

export function useRealtimeAnalysis() {
  const user = useAuthStore((state) => state.user);
  const startAnalysis = useAnalysisStore((state) => state.startAnalysis);
  const addLog = useAnalysisStore((state) => state.addLog);
  const setResults = useAnalysisStore((state) => state.setResults);
  const setStatus = useAnalysisStore((state) => state.setStatus);

  useEffect(() => {
    if (!user) return;

    const socket = io(WS_BASE_URL, {
      transports: ["websocket"],
      withCredentials: true,
      auth: { userId: user._id },
    });

    const shouldHandle = (payload: any) =>
      !payload?.userId || payload.userId === user._id;

    const matchesCurrent = (payload: any) => {
      const currentId = useAnalysisStore.getState().activeAnalysisId;
      return (
        !payload?.analysisId || !currentId || payload.analysisId === currentId
      );
    };

    socket.on("connect", () => {
      addLog({ message: "Connected to live analysis", stream: "system" });
    });

    socket.on("connect_error", (err) => {
      addLog({
        message: `Socket connection error: ${err.message}`,
        stream: "stderr",
      });
      setStatus("error");
    });

    socket.on("analysis:start", (payload) => {
      if (!shouldHandle(payload)) return;
      startAnalysis(payload.analysisId);
      addLog({
        message: `Started analysis for ${payload.projectPath || "project"}`,
        stream: "system",
      });
    });

  socket.on("analysis:log", (payload: any) => {
      if (!shouldHandle(payload) || !matchesCurrent(payload)) return;
      if (!payload?.chunk) return;
      addLog({ message: payload.chunk, stream: payload.stream || "stdout" });
    });

    socket.on("analysis:complete", (payload) => {
      if (!shouldHandle(payload) || !matchesCurrent(payload)) return;
      setResults(payload.result);
      setStatus("completed");
      addLog({ message: "Analysis completed", stream: "system" });
    });

    socket.on("analysis:error", (payload) => {
      if (!shouldHandle(payload) || !matchesCurrent(payload)) return;
      const message = payload?.error || "Analysis failed";
      addLog({ message, stream: "stderr" });
      setStatus("error");
    });

    return () => {
      socket.disconnect();
    };
  }, [addLog, setResults, setStatus, startAnalysis, user]);
}

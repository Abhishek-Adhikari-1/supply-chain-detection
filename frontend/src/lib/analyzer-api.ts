import { AnalysisResult } from "@/hooks/useAnalysis";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const analyzerApi = {
  analyzeProject: async (projectPath: string): Promise<AnalysisResult> => {
    const response = await fetch(`${API_BASE_URL}/api/analyze/project`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectPath }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Analysis failed");
    }

    return response.json();
  },
};

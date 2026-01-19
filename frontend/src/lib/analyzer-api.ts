import type { AnalysisResult } from "@/hooks/useAnalysis";

export type AnalyzeProjectResponse = AnalysisResult & { analysisId: string };

const API_BASE_URL =
  (import.meta as any).env.VITE_API_URL || "http://localhost:5000";

export const analyzerApi = {
  analyzeProject: async (
    projectPath: string,
    analysisId?: string,
  ): Promise<AnalyzeProjectResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/analyze/project`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectPath, analysisId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Analysis failed");
    }

    return response.json();
  },
};

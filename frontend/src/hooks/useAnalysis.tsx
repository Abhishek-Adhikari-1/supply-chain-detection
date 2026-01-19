import { create } from "zustand";

export interface PackageAnalysis {
  package_name: string;
  ecosystem: string;
  label: "SAFE" | "SUSPICIOUS" | "MALICIOUS";
  malicious_probability: number;
  confidence: number;
  top_reasons: string[];
  features: Record<string, number | string>;
}

export interface AnalysisResult {
  project_dir: string;
  packages_scanned: number;
  summary: {
    SAFE: number;
    SUSPICIOUS: number;
    MALICIOUS: number;
  };
  project_risk_signals: Record<string, number>;
  results: PackageAnalysis[];
  timestamp?: string;
}

export type AnalysisStatus = "idle" | "running" | "completed" | "error";

export interface AnalysisLogEntry {
  message: string;
  stream?: "stdout" | "stderr" | "system";
  timestamp?: number;
}

interface AnalysisStore {
  results: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  activeAnalysisId: string | null;
  status: AnalysisStatus;
  logs: AnalysisLogEntry[];
  setResults: (results: AnalysisResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearResults: () => void;
  startAnalysis: (analysisId: string) => void;
  addLog: (entry: AnalysisLogEntry) => void;
  setStatus: (status: AnalysisStatus) => void;
  resetAnalysis: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  results: null,
  isLoading: false,
  error: null,
  activeAnalysisId: null,
  status: "idle",
  logs: [],
  setResults: (results) => set({ results, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearResults: () => set({ results: null, error: null }),
  startAnalysis: (analysisId) =>
    set({
      activeAnalysisId: analysisId,
      status: "running",
      logs: [
        {
          message: "Analysis started",
          stream: "system",
          timestamp: Date.now(),
        },
      ],
      results: null,
      error: null,
    }),
  addLog: (entry) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          ...entry,
          timestamp: entry.timestamp ?? Date.now(),
        },
      ],
    })),
  setStatus: (status) => set({ status }),
  resetAnalysis: () =>
    set({
      activeAnalysisId: null,
      status: "idle",
      logs: [],
      isLoading: false,
      error: null,
      results: null,
    }),
}));

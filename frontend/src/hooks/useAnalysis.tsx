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

interface AnalysisStore {
  results: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  setResults: (results: AnalysisResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearResults: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  results: null,
  isLoading: false,
  error: null,
  setResults: (results) => set({ results, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearResults: () => set({ results: null, error: null }),
}));

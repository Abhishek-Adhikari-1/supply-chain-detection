import { useState, useCallback, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/useAuthStore";
import { useRealtimeAnalysis } from "@/hooks/useRealtimeAnalysis";
import { useAnalysisStore } from "@/hooks/useAnalysis";
import { analyzerApi } from "@/lib/analyzer-api";

const API_URL = "http://localhost:5000/api";

interface ScanResult {
  package: string;
  version?: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  issues: string[];
}

interface ScanResponse {
  success: boolean;
  results: ScanResult[];
  message?: string;
}

// Floating particle component
const FloatingParticle = ({
  delay,
  size,
  left,
  top,
}: {
  delay: number;
  size: number;
  left: string;
  top: string;
}) => (
  <div
    className="absolute rounded-full bg-primary/10 animate-float-slow pointer-events-none"
    style={{
      width: size,
      height: size,
      left,
      top,
      animationDelay: `${delay}s`,
    }}
  />
);

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const {
    results: analysisResults,
    status: analysisStatus,
    logs,
    activeAnalysisId,
    startAnalysis,
    addLog,
    setResults: setAnalysisResults,
    setStatus: setAnalysisStatus,
    resetAnalysis,
  } = useAnalysisStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useRealtimeAnalysis();

  // Generate stable positions for floating particles
  const floatingParticles = useMemo(
    () =>
      [...Array(15)].map((_, i) => ({
        id: i,
        delay: i * 0.5,
        size: 8 + (i % 4) * 6,
        left: `${(i * 6.6) % 100}%`,
        top: `${(i * 17 + 5) % 100}%`,
      })),
    [],
  );

  // Mouse move effect for gradient
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append("file", file);

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await axios.post<ScanResponse>(
        `${API_URL}/packages/scan-file`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setScanResults(response.data.results);
    } catch (err: any) {
      setScanError(err.response?.data?.error || "Failed to scan file");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/json": [".json"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await axios.post<ScanResponse>(
        `${API_URL}/packages/scan-name`,
        { packageName: searchQuery.trim() },
        { withCredentials: true },
      );
      setScanResults(response.data.results);
    } catch (err: any) {
      setScanError(err.response?.data?.error || "Failed to scan package");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAnalyzeProject = async () => {
    if (!projectPath.trim()) return;

    const newAnalysisId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`;

    resetAnalysis();
    startAnalysis(newAnalysisId);
    setAnalysisError(null);
    addLog({
      message: `Submitting analysis for ${projectPath.trim()}`,
      stream: "system",
    });

    try {
      const response = await analyzerApi.analyzeProject(
        projectPath.trim(),
        newAnalysisId,
      );
      const { activeAnalysisId: currentId } = useAnalysisStore.getState();
      if (!currentId || currentId === response.analysisId) {
        setAnalysisResults(response);
        setAnalysisStatus("completed");
        addLog({ message: "HTTP response received", stream: "system" });
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to start analysis";
      setAnalysisStatus("error");
      setAnalysisError(message);
      addLog({ message, stream: "stderr" });
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getAnalysisStatusTone = (status: typeof analysisStatus) => {
    switch (status) {
      case "running":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const summaryTotals = analysisResults?.summary ?? {
    SAFE: 0,
    SUSPICIOUS: 0,
    MALICIOUS: 0,
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Animated gradient background */}
      <div
        className="fixed inset-0 opacity-20 transition-all duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, oklch(0.488 0.243 264.376 / 0.3), transparent 50%),
                       radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, oklch(0.696 0.17 162.48 / 0.2), transparent 50%)`,
        }}
      />

      {/* Floating particles */}
      {floatingParticles.map((particle) => (
        <FloatingParticle
          key={particle.id}
          delay={particle.delay}
          size={particle.size}
          left={particle.left}
          top={particle.top}
        />
      ))}

      {/* Header */}
      <header className="relative z-50 border-b border-border/50 backdrop-blur-md bg-background/80 animate-fade-down">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl text-sm font-bold shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-all duration-300 group-hover:scale-105">
              SC
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Supply Chain Detection
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome,{" "}
              <span className="font-medium text-foreground">{user?.name}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-300"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Scanner Active
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Detect Malicious Packages
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Upload your package.json or requirements.txt file, or search for
              specific packages to detect potential security threats in your
              dependencies.
            </p>
          </div>

          {/* Live Project Analysis (WebSocket) */}
          <div
            className="border border-border/50 rounded-2xl p-6 space-y-4 bg-card/50 backdrop-blur-sm animate-fade-up hover:border-primary/30 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Live Project Analysis
                </p>
                <p className="text-sm text-muted-foreground">
                  Streams start/log/complete events in real time while the
                  backend scanner runs.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold animate-pulse ${getAnalysisStatusTone(analysisStatus)}`}
              >
                {analysisStatus.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="Enter project path (e.g., ./sus_packages/auth-helper)"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="flex-1 bg-background/50"
              />
              <Button
                onClick={handleAnalyzeProject}
                disabled={analysisStatus === "running" || !projectPath.trim()}
                className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
              >
                {analysisStatus === "running"
                  ? "Analyzing..."
                  : "Analyze with live updates"}
              </Button>
            </div>

            {activeAnalysisId && (
              <p className="text-xs text-muted-foreground font-mono">
                Analysis ID: {activeAnalysisId}
              </p>
            )}

            {analysisError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg animate-shake">
                {analysisError}
              </div>
            )}

            {logs.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-muted/40 p-4 font-mono text-xs space-y-1">
                {logs.slice(-12).map((log, idx) => (
                  <div
                    key={`${log.timestamp}-${idx}`}
                    className="whitespace-pre-wrap animate-fade-in"
                  >
                    <span className="text-muted-foreground mr-2">
                      {new Date(
                        log.timestamp ?? Date.now(),
                      ).toLocaleTimeString()}
                    </span>
                    <span
                      className={
                        log.stream === "stderr"
                          ? "text-red-500"
                          : log.stream === "system"
                            ? "text-blue-500"
                            : "text-foreground"
                      }
                    >
                      {log.message.trim()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {analysisResults && analysisStatus === "completed" && (
              <div className="mt-2 space-y-4 rounded-xl border border-border/50 p-4 bg-background/50 animate-fade-up">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 hover:scale-105 transition-transform duration-300">
                    <p className="text-xs text-muted-foreground">Project</p>
                    <p className="font-semibold break-words">
                      {analysisResults.project_dir || "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4 hover:scale-105 transition-transform duration-300">
                    <p className="text-xs text-muted-foreground">
                      Packages scanned
                    </p>
                    <p className="font-semibold text-2xl">
                      {analysisResults.packages_scanned}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-4 hover:scale-105 transition-transform duration-300">
                    <p className="text-xs text-muted-foreground">Summary</p>
                    <p className="font-semibold">
                      <span className="text-red-500">
                        {summaryTotals.MALICIOUS}
                      </span>{" "}
                      malicious /{" "}
                      <span className="text-yellow-500">
                        {summaryTotals.SUSPICIOUS}
                      </span>{" "}
                      suspicious /{" "}
                      <span className="text-green-500">
                        {summaryTotals.SAFE}
                      </span>{" "}
                      safe
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Top results</p>
                  <div className="divide-y divide-border/50 rounded-xl border border-border/50 overflow-hidden">
                    {analysisResults.results.slice(0, 5).map((pkg, idx) => (
                      <div
                        key={`${pkg.package_name}-${pkg.ecosystem}`}
                        className="flex items-center justify-between gap-3 p-4 hover:bg-primary/5 transition-colors duration-300 animate-fade-up"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                      >
                        <div>
                          <p className="font-mono font-medium">
                            {pkg.package_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pkg.ecosystem}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs font-semibold rounded-full px-3 py-1 ${
                              pkg.label === "MALICIOUS"
                                ? "bg-red-500/20 text-red-500"
                                : pkg.label === "SUSPICIOUS"
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : "bg-green-500/20 text-green-500"
                            }`}
                          >
                            {pkg.label}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(pkg.malicious_probability * 100).toFixed(0)}% risk
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search Section */}
          <div
            className="flex gap-2 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Input
              placeholder="Search package by name (e.g., express, lodash)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 bg-background/50 backdrop-blur-sm"
            />
            <Button
              onClick={handleSearch}
              disabled={isScanning || !searchQuery.trim()}
              className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
            >
              {isScanning ? "Scanning..." : "Scan Package"}
            </Button>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 animate-fade-up hover:scale-[1.02] ${
              isDragActive
                ? "border-primary bg-primary/10 scale-[1.02]"
                : "border-border/50 hover:border-primary/50 bg-card/30 backdrop-blur-sm"
            }`}
            style={{ animationDelay: "0.3s" }}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                <svg
                  className={`w-8 h-8 text-primary transition-transform duration-300 ${isDragActive ? "scale-110" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium">
                  {isDragActive
                    ? "Drop the file here..."
                    : "Drag & drop your file here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to select (package.json, requirements.txt)
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {scanError && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-xl animate-shake">
              {scanError}
            </div>
          )}

          {/* Loading State */}
          {isScanning && (
            <div className="flex items-center justify-center py-12 animate-fade-up">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-4 border-primary/20 opacity-20"></div>
              </div>
              <span className="ml-4 text-muted-foreground text-lg">
                Scanning packages...
              </span>
            </div>
          )}

          {/* Results */}
          {scanResults.length > 0 && !isScanning && (
            <div className="space-y-4 animate-fade-up">
              <h3 className="text-2xl font-bold">Scan Results</h3>
              <div className="grid gap-4">
                {scanResults.map((result, index) => (
                  <div
                    key={index}
                    className="border border-border/50 rounded-xl p-5 space-y-3 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 animate-fade-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-lg">
                          {result.package}
                        </span>
                        {result.version && (
                          <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                            v{result.version}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getRiskColor(
                            result.riskLevel,
                          )}`}
                        >
                          {result.riskLevel.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Score:{" "}
                          <span className="font-semibold text-foreground">
                            {result.riskScore}/100
                          </span>
                        </span>
                      </div>
                    </div>
                    {result.issues.length > 0 && (
                      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
                        <p className="font-medium mb-2 text-foreground">
                          Issues found:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {result.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-30px) scale(1.2); opacity: 0.7; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-fade-up { animation: fade-up 0.6s ease-out forwards; opacity: 0; }
        .animate-fade-down { animation: fade-down 0.6s ease-out forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}

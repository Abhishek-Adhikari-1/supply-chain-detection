import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuth";
import { useAnalysisStore } from "@/hooks/useAnalysis";
import { analyzerApi } from "@/lib/analyzer-api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isLoading, checkAuth, logout } = useAuthStore();
  const {
    results,
    isLoading: analysisLoading,
    setLoading,
    setResults,
    setError,
  } = useAnalysisStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name !== "package.json" && file.name !== "requirements.txt") {
      toast.error("Please upload package.json or requirements.txt");
      return;
    }

    setSelectedFile(file);
    toast.success(`File selected: ${file.name}`);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Please select a package.json or requirements.txt file");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        (import.meta as any).env.VITE_API_URL + "/api/analyze/upload",
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      setResults({ ...result, timestamp: new Date().toISOString() });
      toast.success(
        `Analysis complete: ${result.packages_scanned} packages scanned`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analysis failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold">
              SC
            </div>
            <h1 className="text-xl font-bold">Supply Chain Guardian</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <button onClick={handleLogout} className="text-sm hover:underline">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            AI-Powered Package Security Analysis
          </p>
        </div>

        {/* Analysis Input */}
        <div className="border rounded-lg p-6 mb-8 bg-card">
          <h3 className="font-semibold mb-4">Upload Dependencies File</h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={analysisLoading}
              >
                Choose File
              </Button>
              {selectedFile && (
                <div className="flex-1 px-3 py-2 border rounded-md bg-background flex items-center justify-between">
                  <span className="text-sm">{selectedFile.name}</span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              )}
              {!selectedFile && (
                <div className="flex-1 px-3 py-2 border rounded-md bg-background text-muted-foreground flex items-center">
                  <span className="text-sm">No file selected</span>
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <p>
                ✓ Supported formats:{" "}
                <code className="bg-muted px-1 rounded">package.json</code>{" "}
                (npm) or{" "}
                <code className="bg-muted px-1 rounded">requirements.txt</code>{" "}
                (pip)
              </p>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={analysisLoading || !selectedFile}
              className="w-full"
            >
              {analysisLoading ? "Analyzing..." : "Analyze"}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="border rounded-lg p-6">
            <div className="text-2xl font-bold">
              {results?.packages_scanned ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">
              Packages Scanned
            </div>
          </div>
          <div className="border rounded-lg p-6">
            <div className="text-2xl font-bold text-green-600">
              {results?.summary.SAFE ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">Safe Packages</div>
          </div>
          <div className="border rounded-lg p-6">
            <div className="text-2xl font-bold text-red-600">
              {results?.summary.MALICIOUS ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">Threats Found</div>
          </div>
        </div>

        {/* Analysis Results */}
        {results && (
          <div className="border rounded-lg">
            <div className="border-b p-4">
              <h3 className="font-semibold">Scan Results</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(results.timestamp || "").toLocaleString()}
              </p>
            </div>
            <div className="p-4">
              {results.results.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No packages found in project.
                </div>
              ) : (
                <div className="space-y-3">
                  {results.results.map((pkg) => {
                    const riskColor =
                      pkg.label === "MALICIOUS"
                        ? "text-red-600"
                        : pkg.label === "SUSPICIOUS"
                          ? "text-yellow-600"
                          : "text-green-600";

                    return (
                      <div
                        key={`${pkg.ecosystem}-${pkg.package_name}`}
                        className="border rounded p-3 hover:bg-muted/50 transition cursor-pointer"
                        onClick={() =>
                          navigate(
                            `/threat?package=${encodeURIComponent(pkg.package_name)}&ecosystem=${pkg.ecosystem}`,
                          )
                        }
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold">{pkg.package_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {pkg.ecosystem}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${riskColor}`}>
                              {(pkg.malicious_probability * 100).toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {pkg.label}
                            </p>
                          </div>
                        </div>
                        {pkg.top_reasons.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <p className="mb-1">Top concerns:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {pkg.top_reasons.slice(0, 2).map((reason, i) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

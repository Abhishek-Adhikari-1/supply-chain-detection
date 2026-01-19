import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/useAuthStore";

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

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append("file", file);

    setIsScanning(true);
    setError(null);

    try {
      const response = await axios.post<ScanResponse>(
        `${API_URL}/packages/scan-file`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setResults(response.data.results);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to scan file");
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
    setError(null);

    try {
      const response = await axios.post<ScanResponse>(
        `${API_URL}/packages/scan-name`,
        { packageName: searchQuery.trim() },
        { withCredentials: true },
      );
      setResults(response.data.results);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to scan package");
    } finally {
      setIsScanning(false);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold">
              SC
            </div>
            <h1 className="text-xl font-semibold">Supply Chain Detection</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Detect Malicious Packages</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Upload your package.json or requirements.txt file, or search for
              specific packages to detect potential security threats in your
              dependencies.
            </p>
          </div>

          {/* Search Section */}
          <div className="flex gap-2">
            <Input
              placeholder="Search package by name (e.g., express, lodash)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={isScanning || !searchQuery.trim()}
            >
              {isScanning ? "Scanning..." : "Scan Package"}
            </Button>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-primary"
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
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isScanning && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">
                Scanning packages...
              </span>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && !isScanning && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Scan Results</h3>
              <div className="grid gap-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium">
                          {result.package}
                        </span>
                        {result.version && (
                          <span className="text-sm text-muted-foreground">
                            v{result.version}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium text-white ${getRiskColor(
                            result.riskLevel,
                          )}`}
                        >
                          {result.riskLevel.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Score: {result.riskScore}/100
                        </span>
                      </div>
                    </div>
                    {result.issues.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Issues found:</p>
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
    </div>
  );
}

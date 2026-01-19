import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/useAuthStore";
import axios from "axios";
import { toast } from "sonner";
import {
  Home,
  Plus,
  Trash2,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

interface Package {
  name: string;
  version: string;
}

interface ScanResult {
  package: string;
  version?: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  issues: string[];
}

export default function ComparePage() {
  const { user, logout } = useAuthStore();
  const [packages, setPackages] = useState<Package[]>([
    { name: "", version: "" },
    { name: "", version: "" },
  ]);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);

  const addPackage = () => {
    setPackages([...packages, { name: "", version: "" }]);
  };

  const removePackage = (index: number) => {
    if (packages.length > 2) {
      setPackages(packages.filter((_, i) => i !== index));
    }
  };

  const updatePackage = (
    index: number,
    field: "name" | "version",
    value: string,
  ) => {
    const updated = [...packages];
    updated[index][field] = value;
    setPackages(updated);
  };

  const handleCompare = async () => {
    const validPackages = packages.filter((p) => p.name.trim());

    if (validPackages.length < 2) {
      toast.error("Please enter at least 2 packages to compare");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const responses = await Promise.all(
        validPackages.map((pkg) =>
          axios.post(
            `${API_URL}/packages/scan-name`,
            { packageName: pkg.name, version: pkg.version || "latest" },
            { withCredentials: true },
          ),
        ),
      );

      const allResults = responses.flatMap((r) => r.data.results);
      setResults(allResults);
      toast.success("Comparison completed!");
    } catch (error: any) {
      toast.error("Comparison failed", {
        description:
          error.response?.data?.error || "Failed to compare packages",
      });
    } finally {
      setLoading(false);
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
      default:
        return "bg-green-500";
    }
  };

  const getBestOption = () => {
    if (results.length === 0) return null;
    return results.reduce((best, current) =>
      current.riskScore < best.riskScore ? current : best,
    );
  };

  const bestOption = getBestOption();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-white">Package Comparison</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/70">{user?.name}</span>
            <Button onClick={logout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Input Section */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Compare Packages
            </CardTitle>
            <p className="text-sm text-white/60">
              Enter package names to compare their security risks and choose the
              safest option
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {packages.map((pkg, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Package name (e.g., express, lodash)"
                    value={pkg.name}
                    onChange={(e) =>
                      updatePackage(index, "name", e.target.value)
                    }
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="w-32">
                  <Input
                    placeholder="Version"
                    value={pkg.version}
                    onChange={(e) =>
                      updatePackage(index, "version", e.target.value)
                    }
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                {packages.length > 2 && (
                  <Button
                    onClick={() => removePackage(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                onClick={addPackage}
                variant="outline"
                size="sm"
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Package
              </Button>
              <Button
                onClick={handleCompare}
                disabled={loading}
                className="ml-auto"
              >
                {loading ? "Comparing..." : "Compare"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <>
            {/* Best Option Banner */}
            {bestOption && (
              <Card className="bg-green-500/10 border-green-500/20 backdrop-blur-sm mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                    <div>
                      <div className="text-lg font-semibold text-white">
                        Recommended: {bestOption.package}
                      </div>
                      <div className="text-sm text-green-300">
                        Lowest risk score: {bestOption.riskScore}/100
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((result, index) => (
                <Card
                  key={index}
                  className={`bg-white/5 border-white/10 backdrop-blur-sm ${
                    result.package === bestOption?.package
                      ? "ring-2 ring-green-500/50"
                      : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-white text-lg">
                          {result.package}
                        </CardTitle>
                        {result.version && (
                          <Badge
                            variant="outline"
                            className="mt-2 text-white/60"
                          >
                            v{result.version}
                          </Badge>
                        )}
                      </div>
                      {result.package === bestOption?.package && (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Risk Score */}
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-sm text-white/60 mb-1">
                        Risk Score
                      </div>
                      <div
                        className={`text-4xl font-bold ${
                          result.riskScore >= 80
                            ? "text-red-400"
                            : result.riskScore >= 60
                              ? "text-orange-400"
                              : result.riskScore >= 40
                                ? "text-yellow-400"
                                : "text-green-400"
                        }`}
                      >
                        {result.riskScore}
                      </div>
                      <Badge
                        className={`mt-2 ${getRiskColor(result.riskLevel)} text-white`}
                      >
                        {result.riskLevel.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Issues */}
                    {result.issues.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          <AlertTriangle className="h-4 w-4" />
                          Issues Found ({result.issues.length})
                        </div>
                        <ul className="space-y-1">
                          {result.issues.slice(0, 3).map((issue, i) => (
                            <li
                              key={i}
                              className="text-xs text-white/60 pl-4 border-l-2 border-white/20"
                            >
                              {issue}
                            </li>
                          ))}
                          {result.issues.length > 3 && (
                            <li className="text-xs text-white/40 pl-4">
                              +{result.issues.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Verdict */}
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-xs text-white/40">
                        {result.riskScore < 40
                          ? "✓ Safe to use"
                          : result.riskScore < 70
                            ? "⚠ Review before using"
                            : "⛔ Not recommended"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {results.length === 0 && !loading && (
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <ArrowLeftRight className="h-16 w-16 mx-auto mb-4 text-white/20" />
              <p className="text-white/60">
                Enter package names above and click Compare to see results
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </div>
  );
}

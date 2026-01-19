import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/useAuthStore";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Shield,
  Zap,
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

export default function ComparePage() {
  const { user, logout } = useAuthStore();
  const [packages, setPackages] = useState<Package[]>([
    { name: "", version: "" },
    { name: "", version: "" },
  ]);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  // Generate stable positions for floating particles
  const floatingParticles = useMemo(
    () =>
      [...Array(12)].map((_, i) => ({
        id: i,
        delay: i * 0.5,
        size: 8 + (i % 4) * 6,
        left: `${(i * 8.3) % 100}%`,
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
            {
              packageName: pkg.name,
              version: pkg.version || "latest",
            },
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

  const getRiskGradient = (level: string) => {
    switch (level) {
      case "critical":
        return "from-red-500/20 to-red-500/5";
      case "high":
        return "from-orange-500/20 to-orange-500/5";
      case "medium":
        return "from-yellow-500/20 to-yellow-500/5";
      default:
        return "from-green-500/20 to-green-500/5";
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
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary/10 transition-all duration-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-xs font-bold shadow-lg shadow-primary/30">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                Package Comparison
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome,{" "}
              <span className="font-medium text-foreground">{user?.name}</span>
            </span>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-300"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              Smart Comparison
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Compare Package Security
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Enter package names to compare their security risks side by side
              and choose the safest option for your project.
            </p>
          </div>

          {/* Input Section */}
          <Card
            className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-up hover:border-primary/30 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5"
            style={{ animationDelay: "0.1s" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="block">Add Packages</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Enter package names and versions to compare
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {packages.map((pkg, index) => (
                <div
                  key={index}
                  className="flex gap-2 animate-fade-up"
                  style={{
                    animationDelay: `${index * 0.05}s`,
                  }}
                >
                  <div className="flex items-center justify-center w-8 h-10 rounded-lg bg-primary/10 text-primary text-sm font-bold shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Package name (e.g., express, lodash)"
                      value={pkg.name}
                      onChange={(e) =>
                        updatePackage(index, "name", e.target.value)
                      }
                      className="bg-background/50 backdrop-blur-sm transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      placeholder="Version"
                      value={pkg.version}
                      onChange={(e) =>
                        updatePackage(index, "version", e.target.value)
                      }
                      className="bg-background/50 backdrop-blur-sm transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  {packages.length > 2 && (
                    <Button
                      onClick={() => removePackage(index)}
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={addPackage}
                  variant="outline"
                  size="sm"
                  className="hover:bg-primary/10 hover:border-primary/50 transition-all duration-300"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Package
                </Button>
                <Button
                  onClick={handleCompare}
                  disabled={loading}
                  className="ml-auto shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/20 border-t-primary-foreground mr-2" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                      Compare
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {results.length > 0 && (
            <>
              {/* Best Option Banner */}
              {bestOption && (
                <Card
                  className="border-green-500/30 bg-gradient-to-r from-green-500/10 to-green-500/5 backdrop-blur-sm animate-fade-up overflow-hidden"
                  style={{ animationDelay: "0.1s" }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-green-500/20 animate-pulse">
                        <Shield className="h-8 w-8 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-semibold flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                          Recommended: {bestOption.package}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          This package has the lowest risk score of{" "}
                          <span className="font-bold text-green-400">
                            {bestOption.riskScore}
                            /100
                          </span>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-sm px-4 py-1">
                        Best Choice
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((result, index) => (
                  <Card
                    key={index}
                    className={`border-border/50 bg-card/50 backdrop-blur-sm animate-fade-up hover:scale-[1.02] transition-all duration-300 hover:shadow-lg ${
                      result.package === bestOption?.package
                        ? "ring-2 ring-green-500/50 hover:shadow-green-500/10"
                        : "hover:border-primary/30 hover:shadow-primary/5"
                    }`}
                    style={{
                      animationDelay: `${(index + 1) * 0.1}s`,
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {result.package}
                            {result.package === bestOption?.package && (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            )}
                          </CardTitle>
                          {result.version && (
                            <Badge
                              variant="outline"
                              className="mt-2 text-muted-foreground"
                            >
                              v{result.version}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Risk Score */}
                      <div
                        className={`text-center p-4 rounded-xl bg-gradient-to-br ${getRiskGradient(result.riskLevel)} transition-all duration-300 hover:scale-105`}
                      >
                        <div className="text-sm text-muted-foreground mb-1">
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
                          className={`mt-2 ${getRiskColor(result.riskLevel)} text-white border-0`}
                        >
                          {result.riskLevel.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Issues */}
                      {result.issues.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Issues Found ({result.issues.length})
                          </div>
                          <ul className="space-y-1">
                            {result.issues.slice(0, 3).map((issue, i) => (
                              <li
                                key={i}
                                className="text-xs text-muted-foreground pl-4 border-l-2 border-border/50 hover:border-primary/50 transition-colors duration-300"
                              >
                                {issue}
                              </li>
                            ))}
                            {result.issues.length > 3 && (
                              <li className="text-xs text-muted-foreground/60 pl-4">
                                +{result.issues.length - 3} more issues
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Verdict */}
                      <div className="pt-2 border-t border-border/50">
                        <div
                          className={`text-sm font-medium flex items-center gap-2 ${
                            result.riskScore < 40
                              ? "text-green-400"
                              : result.riskScore < 70
                                ? "text-yellow-400"
                                : "text-red-400"
                          }`}
                        >
                          {result.riskScore < 40 ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Safe to use
                            </>
                          ) : result.riskScore < 70 ? (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              Review before using
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              Not recommended
                            </>
                          )}
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
            <Card
              className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-up hover:border-primary/30 transition-all duration-500"
              style={{ animationDelay: "0.2s" }}
            >
              <CardContent className="p-12 text-center">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <ArrowLeftRight className="h-10 w-10 text-primary/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  No Comparisons Yet
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Enter package names above and click Compare to see a
                  side-by-side security analysis
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-up">
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary" />
                <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-4 border-primary/20 opacity-20" />
              </div>
              <p className="text-lg font-medium">Analyzing packages...</p>
              <p className="text-sm text-muted-foreground mt-1">
                This may take a few seconds
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
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

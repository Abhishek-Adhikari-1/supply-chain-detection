import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Shield,
  Play,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/useAuthStore";
import { socket } from "@/lib/socket";

interface SandboxResult {
  risk_score: number;
  threat_level: string;
  network_activities: Array<{
    ip: string;
    port: number;
    timestamp: string;
  }>;
  file_operations: Array<{
    operation: string;
    path: string;
    timestamp: string;
  }>;
  suspicious_patterns: string[];
  recommendations: string[];
  execution_summary?: {
    duration: number;
    exit_code: number;
  };
  error?: string;
}

const SUSPICIOUS_PACKAGES = [
  {
    path: "sus_packages/auth-helper",
    name: "auth-helper (Data Exfiltration)",
    type: "npm",
  },
  {
    path: "sus_packages/crypto-miner",
    name: "crypto-miner (Cryptominer)",
    type: "npm",
  },
  {
    path: "sus_packages/package1_exfiltration",
    name: "package1 (Exfiltration)",
    type: "npm",
  },
  {
    path: "sus_packages/package2_backdoor",
    name: "package2 (Backdoor)",
    type: "npm",
  },
  {
    path: "sus_packages/package3_cryptominer",
    name: "package3 (Cryptominer)",
    type: "npm",
  },
  {
    path: "sus_packages/py_backdoor",
    name: "py_backdoor (Python)",
    type: "pypi",
  },
];

export default function SandboxPage() {
  const navigate = useNavigate();
  const authState = useAuthStore();
  const authUser = authState.user;
  const [selectedPackage, setSelectedPackage] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [packageType, setPackageType] = useState<"npm" | "pypi">("npm");
  const [timeout, setTimeout] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sandboxId, setSandboxId] = useState<string>("");

  useEffect(() => {
    if (authUser?._id) {
      socket.emit("join:user", authUser._id);
    }

    const handleSandboxStart = (data: any) => {
      console.log("Sandbox started:", data);
      setSandboxId(data.sandboxId);
      setIsRunning(true);
      setLogs([`🚀 Sandbox test started for ${data.packagePath}`]);
      setResult(null);
    };

    const handleSandboxLog = (data: any) => {
      if (data.sandboxId === sandboxId || !sandboxId) {
        setLogs((prev) => [...prev, data.chunk]);
      }
    };

    const handleSandboxComplete = (data: any) => {
      console.log("Sandbox complete:", data);
      setIsRunning(false);
      setResult(data.results);
      setLogs((prev) => [...prev, "✅ Sandbox test completed"]);

      const riskScore = data.results?.risk_score || 0;
      if (riskScore >= 70) {
        toast.error("CRITICAL threat detected!", {
          description: `Risk score: ${riskScore}/100`,
        });
      } else if (riskScore >= 40) {
        toast.warning("Medium risk detected", {
          description: `Risk score: ${riskScore}/100`,
        });
      } else {
        toast.success("Package appears safe", {
          description: `Risk score: ${riskScore}/100`,
        });
      }
    };

    const handleSandboxError = (data: any) => {
      console.error("Sandbox error:", data);
      setIsRunning(false);
      setLogs((prev) => [...prev, `❌ Error: ${data.error}`]);
      toast.error("Sandbox test failed", {
        description: data.error,
      });
    };

    socket.on("sandbox:start", handleSandboxStart);
    socket.on("sandbox:log", handleSandboxLog);
    socket.on("sandbox:complete", handleSandboxComplete);
    socket.on("sandbox:error", handleSandboxError);

    return () => {
      socket.off("sandbox:start", handleSandboxStart);
      socket.off("sandbox:log", handleSandboxLog);
      socket.off("sandbox:complete", handleSandboxComplete);
      socket.off("sandbox:error", handleSandboxError);
    };
  }, [authUser, sandboxId]);

  const handleRunTest = async () => {
    const packagePath = selectedPackage || customPath;

    if (!packagePath) {
      toast.error("Please select or enter a package path");
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setResult(null);

    try {
      const response = await fetch(
        "http://localhost:5000/api/analyze/sandbox",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            packagePath,
            packageType,
            timeout,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sandbox test failed");
      }

      // Result will be received via socket
    } catch (error: any) {
      console.error("Sandbox test error:", error);
      toast.error("Failed to start sandbox test", {
        description: error.message,
      });
      setIsRunning(false);
    }
  };

  const getThreatColor = (score: number) => {
    if (score >= 70) return "text-red-500";
    if (score >= 40) return "text-yellow-500";
    return "text-green-500";
  };

  const getThreatBadge = (level: string) => {
    const colors: any = {
      CRITICAL: "destructive",
      MEDIUM: "warning",
      LOW: "secondary",
    };
    return colors[level] || "secondary";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Docker Sandbox Testing</h1>
              <p className="text-muted-foreground">
                Test suspicious packages in an isolated environment
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
              <CardDescription>
                Select a package or enter a custom path
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pre-loaded Suspicious Packages</Label>
                <Select
                  value={selectedPackage}
                  onValueChange={(value) => {
                    setSelectedPackage(value);
                    setCustomPath("");
                    const pkg = SUSPICIOUS_PACKAGES.find(
                      (p) => p.path === value,
                    );
                    if (pkg) setPackageType(pkg.type as "npm" | "pypi");
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a package..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SUSPICIOUS_PACKAGES.map((pkg) => (
                      <SelectItem key={pkg.path} value={pkg.path}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custom Package Path</Label>
                <Input
                  placeholder="e.g., sus_packages/custom-package"
                  value={customPath}
                  onChange={(e) => {
                    setCustomPath(e.target.value);
                    setSelectedPackage("");
                  }}
                  disabled={isRunning}
                />
              </div>

              <div className="space-y-2">
                <Label>Package Type</Label>
                <Select
                  value={packageType}
                  onValueChange={(value: any) => setPackageType(value)}
                  disabled={isRunning}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="npm">
                      npm (JavaScript/Node.js)
                    </SelectItem>
                    <SelectItem value="pypi">PyPI (Python)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Timeout (seconds)</Label>
                <Input
                  type="number"
                  min="10"
                  max="300"
                  value={timeout}
                  onChange={(e) => setTimeout(parseInt(e.target.value))}
                  disabled={isRunning}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleRunTest}
                disabled={isRunning || (!selectedPackage && !customPath)}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Sandbox Test
                  </>
                )}
              </Button>

              {isRunning && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sandbox is running in isolated Docker container...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Real-time analysis and threat assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="network">Network</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  {result ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">
                              Risk Score
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div
                              className={`text-4xl font-bold ${getThreatColor(result.risk_score)}`}
                            >
                              {result.risk_score}/100
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">
                              Threat Level
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Badge
                              variant={getThreatBadge(result.threat_level)}
                            >
                              {result.threat_level}
                            </Badge>
                          </CardContent>
                        </Card>
                      </div>

                      {result.error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {result.error}
                          </p>
                        </div>
                      )}

                      {result.suspicious_patterns &&
                        result.suspicious_patterns.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-yellow-500" />
                              Suspicious Patterns
                            </h3>
                            <ul className="space-y-1">
                              {result.suspicious_patterns.map(
                                (pattern, idx) => (
                                  <li
                                    key={idx}
                                    className="text-sm text-muted-foreground pl-4"
                                  >
                                    • {pattern}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}

                      {result.recommendations &&
                        result.recommendations.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              Recommendations
                            </h3>
                            <ul className="space-y-1">
                              {result.recommendations.map((rec, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-muted-foreground pl-4"
                                >
                                  • {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>
                        No results yet. Run a sandbox test to see the analysis.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="network" className="space-y-2">
                  {result?.network_activities &&
                  result.network_activities.length > 0 ? (
                    <div className="space-y-2">
                      {result.network_activities.map((activity, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-secondary/50 rounded-lg text-sm"
                        >
                          <div className="flex justify-between">
                            <span className="font-mono">
                              {activity.ip}:{activity.port}
                            </span>
                            <span className="text-muted-foreground">
                              {activity.timestamp}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No network activity detected</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="files" className="space-y-2">
                  {result?.file_operations &&
                  result.file_operations.length > 0 ? (
                    <div className="space-y-2">
                      {result.file_operations.map((op, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-secondary/50 rounded-lg text-sm"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <Badge variant="outline" className="mb-1">
                                {op.operation}
                              </Badge>
                              <p className="font-mono text-xs">{op.path}</p>
                            </div>
                            <span className="text-muted-foreground text-xs">
                              {op.timestamp}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No file operations detected</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="logs">
                  <div className="bg-black/90 rounded-lg p-4 font-mono text-xs text-green-400 h-96 overflow-y-auto">
                    {logs.length > 0 ? (
                      logs.map((log, idx) => <div key={idx}>{log}</div>)
                    ) : (
                      <div className="text-gray-500">No logs yet...</div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

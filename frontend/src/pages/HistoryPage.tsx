import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/useAuthStore";
import axios from "axios";
import {
  Download,
  Search,
  Package,
  AlertTriangle,
  Clock,
  FileText,
  Home,
  ArrowLeft,
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

interface HistoryItem {
  _id: string;
  packageName?: string;
  projectPath?: string;
  riskScore: number;
  riskLevel: string;
  issuesCount: number;
  scannedAt: string;
  scanType: "file" | "package" | "project";
  results?: any;
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

export default function HistoryPage() {
  const { user, logout } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

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

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    filterResults();
  }, [searchQuery, filterLevel, filterType, history]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/packages/history`, {
        withCredentials: true,
      });
      setHistory(response.data.history || []);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterResults = () => {
    let filtered = [...history];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.packageName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.projectPath?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Risk level filter
    if (filterLevel !== "all") {
      filtered = filtered.filter((item) => item.riskLevel === filterLevel);
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((item) => item.scanType === filterType);
    }

    setFilteredHistory(filtered);
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

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "default";
    }
  };

  const exportHistory = (format: "json" | "csv") => {
    if (format === "json") {
      const dataStr = JSON.stringify(filteredHistory, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
      const exportFileDefaultName = `scan-history-${new Date().toISOString().split("T")[0]}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    } else if (format === "csv") {
      const headers = [
        "Date",
        "Name",
        "Type",
        "Risk Level",
        "Risk Score",
        "Issues Count",
      ];
      const rows = filteredHistory.map((item) => [
        new Date(item.scannedAt).toLocaleString(),
        item.packageName || item.projectPath || "N/A",
        item.scanType,
        item.riskLevel,
        item.riskScore,
        item.issuesCount,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const dataUri =
        "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const exportFileDefaultName = `scan-history-${new Date().toISOString().split("T")[0]}.csv`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    }
  };

  const getStats = () => {
    return {
      total: history.length,
      critical: history.filter((h) => h.riskLevel === "critical").length,
      high: history.filter((h) => h.riskLevel === "high").length,
      medium: history.filter((h) => h.riskLevel === "medium").length,
      low: history.filter((h) => h.riskLevel === "low").length,
    };
  };

  const stats = getStats();

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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary/10 transition-all duration-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl text-sm font-bold shadow-lg shadow-primary/30">
                <Clock className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Scan History</h1>
            </div>
          </div>
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

      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm hover:scale-105 transition-all duration-300 animate-fade-up">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Total Scans
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.total}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="bg-red-500/10 border-red-500/20 backdrop-blur-sm hover:scale-105 transition-all duration-300 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <div className="text-sm text-red-300">Critical</div>
                  <div className="text-2xl font-bold text-red-400">
                    {stats.critical}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="bg-orange-500/10 border-orange-500/20 backdrop-blur-sm hover:scale-105 transition-all duration-300 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <div className="text-sm text-orange-300">High</div>
                  <div className="text-2xl font-bold text-orange-400">
                    {stats.high}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="bg-yellow-500/10 border-yellow-500/20 backdrop-blur-sm hover:scale-105 transition-all duration-300 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-sm text-yellow-300">Medium</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {stats.medium}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="bg-green-500/10 border-green-500/20 backdrop-blur-sm hover:scale-105 transition-all duration-300 animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Package className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-sm text-green-300">Low</div>
                  <div className="text-2xl font-bold text-green-400">
                    {stats.low}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Export */}
        <Card
          className="bg-card/50 border-border/50 backdrop-blur-sm mb-6 animate-fade-up"
          style={{ animationDelay: "0.5s" }}
        >
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search packages or projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/50 border-border/50 text-foreground"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="px-3 py-2 rounded-md bg-background/50 border border-border/50 text-foreground text-sm transition-all duration-300 hover:border-primary/50"
                >
                  <option value="all">All Levels</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 rounded-md bg-background/50 border border-border/50 text-foreground text-sm transition-all duration-300 hover:border-primary/50"
                >
                  <option value="all">All Types</option>
                  <option value="file">File</option>
                  <option value="package">Package</option>
                  <option value="project">Project</option>
                </select>
                <Button
                  onClick={() => exportHistory("json")}
                  variant="outline"
                  size="sm"
                  className="hover:bg-primary/10 transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  onClick={() => exportHistory("csv")}
                  variant="outline"
                  size="sm"
                  className="hover:bg-primary/10 transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* History List */}
        {loading ? (
          <div className="flex items-center justify-center py-12 animate-fade-up">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
              <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-4 border-primary/20 opacity-20"></div>
            </div>
            <span className="ml-4 text-muted-foreground text-lg">
              Loading history...
            </span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm animate-fade-up">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-primary/40" />
              </div>
              <p className="text-muted-foreground text-lg">
                No scan history found
              </p>
              <p className="text-muted-foreground/60 text-sm mt-2">
                Start scanning packages to build your history
              </p>
              <Link to="/dashboard">
                <Button className="mt-6 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item, index) => (
              <Card
                key={item._id}
                className="bg-card/50 border-border/50 backdrop-blur-sm hover:bg-card/70 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 animate-fade-up group"
                style={{ animationDelay: `${0.6 + index * 0.05}s` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {item.packageName || item.projectPath || "Unknown"}
                        </h3>
                        <Badge
                          variant={getRiskBadgeVariant(item.riskLevel) as any}
                          className="capitalize"
                        >
                          {item.riskLevel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-muted-foreground capitalize"
                        >
                          {item.scanType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground ml-12">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(item.scannedAt).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          {item.issuesCount} issues
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          Risk Score
                        </div>
                        <div
                          className={`text-2xl font-bold ${
                            item.riskScore >= 80
                              ? "text-red-400"
                              : item.riskScore >= 60
                                ? "text-orange-400"
                                : item.riskScore >= 40
                                  ? "text-yellow-400"
                                  : "text-green-400"
                          }`}
                        >
                          {item.riskScore}
                        </div>
                      </div>
                      <div
                        className={`h-12 w-2 rounded-full ${getRiskColor(item.riskLevel)} transition-all duration-300 group-hover:w-3`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-fade-up { animation: fade-up 0.6s ease-out forwards; opacity: 0; }
        .animate-fade-down { animation: fade-down 0.6s ease-out forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}

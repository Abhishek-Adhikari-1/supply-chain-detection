import { useState, useEffect } from "react";
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

export default function HistoryPage() {
  const { user, logout } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

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
            <h1 className="text-xl font-bold text-white">Scan History</h1>
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
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="text-sm text-white/60">Total Scans</div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="text-sm text-red-300">Critical</div>
              <div className="text-2xl font-bold text-red-400">
                {stats.critical}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-500/10 border-orange-500/20 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="text-sm text-orange-300">High</div>
              <div className="text-2xl font-bold text-orange-400">
                {stats.high}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/20 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="text-sm text-yellow-300">Medium</div>
              <div className="text-2xl font-bold text-yellow-400">
                {stats.medium}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="text-sm text-green-300">Low</div>
              <div className="text-2xl font-bold text-green-400">
                {stats.low}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Export */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="Search packages or projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm"
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
                  className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm"
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
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  onClick={() => exportHistory("csv")}
                  variant="outline"
                  size="sm"
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
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-white/20" />
              <p className="text-white/60">No scan history found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <Card
                key={item._id}
                className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Package className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold text-white">
                          {item.packageName || item.projectPath || "Unknown"}
                        </h3>
                        <Badge variant={getRiskBadgeVariant(item.riskLevel)}>
                          {item.riskLevel}
                        </Badge>
                        <Badge variant="outline" className="text-white/60">
                          {item.scanType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/60">
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
                        <div className="text-sm text-white/60">Risk Score</div>
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
                        className={`h-12 w-2 rounded-full ${getRiskColor(item.riskLevel)}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

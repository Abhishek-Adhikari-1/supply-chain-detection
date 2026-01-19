import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAnalysisStore } from "@/hooks/useAnalysis";
import { useAuthStore } from "@/hooks/useAuth";
import { useEffect } from "react";

export default function ThreatDetailPage() {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuthStore();
  const { results } = useAnalysisStore();
  const [searchParams] = useSearchParams();
  const packageName = searchParams.get("package");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!user) {
    return null;
  }

  if (!results || !packageName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No threat data found</p>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const pkg = results.results.find(
    (p) =>
      p.package_name === packageName &&
      p.ecosystem === searchParams.get("ecosystem"),
  );

  if (!pkg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Package not found</p>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const riskColor =
    pkg.label === "MALICIOUS"
      ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
      : pkg.label === "SUSPICIOUS"
        ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
        : "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800";

  const riskTextColor =
    pkg.label === "MALICIOUS"
      ? "text-red-600 dark:text-red-400"
      : pkg.label === "SUSPICIOUS"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-green-600 dark:text-green-400";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            ← Back to Dashboard
          </Button>
          <h1 className="text-xl font-bold">Threat Analysis</h1>
          <div className="w-24" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        {/* Threat Header */}
        <div className={`border rounded-lg p-6 mb-8 ${riskColor}`}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold">{pkg.package_name}</h2>
              <p className="text-muted-foreground mt-1">
                Ecosystem: {pkg.ecosystem}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${riskTextColor}`}>
                {(pkg.malicious_probability * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Malicious Probability
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Classification</p>
              <p className={`font-semibold ${riskTextColor}`}>{pkg.label}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="font-semibold">
                {(pkg.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Scan Depth</p>
              <p className="font-semibold">
                {pkg.features.scan_depth || "declared"}
              </p>
            </div>
          </div>
        </div>

        {/* Top Reasons */}
        {pkg.top_reasons.length > 0 && (
          <div className="border rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold mb-4">Top Concerns</h3>
            <div className="space-y-3">
              {pkg.top_reasons.map((reason, i) => (
                <div key={i} className="flex gap-3">
                  <div className="text-lg">🚨</div>
                  <p className="text-sm">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Analysis */}
        <div className="border rounded-lg p-6 mb-8">
          <h3 className="text-xl font-bold mb-4">Feature Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(pkg.features)
              .filter(([key]) => key !== "scan_depth")
              .map(([key, value]) => (
                <div key={key} className="border rounded p-3">
                  <p className="text-xs text-muted-foreground font-mono">
                    {key}
                  </p>
                  <p className="font-semibold text-lg">
                    {typeof value === "number"
                      ? value.toFixed(2)
                      : String(value)}
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* Actions */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Recommended Actions</h3>
          <div className="space-y-3">
            {pkg.label === "MALICIOUS" && (
              <>
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 rounded">
                  <span className="text-lg">🛑</span>
                  <div>
                    <p className="font-semibold">Block Installation</p>
                    <p className="text-sm text-muted-foreground">
                      Do not install this package. It exhibits malicious
                      behavior.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded">
                  <span className="text-lg">📢</span>
                  <div>
                    <p className="font-semibold">Report to Registry</p>
                    <p className="text-sm text-muted-foreground">
                      Report this package to npm/PyPI security team.
                    </p>
                  </div>
                </div>
              </>
            )}
            {pkg.label === "SUSPICIOUS" && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded">
                <span className="text-lg">👁️</span>
                <div>
                  <p className="font-semibold">Manual Code Review</p>
                  <p className="text-sm text-muted-foreground">
                    Review the source code manually before installation.
                  </p>
                </div>
              </div>
            )}
            {pkg.label === "SAFE" && (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded">
                <span className="text-lg">✓</span>
                <div>
                  <p className="font-semibold">Package is Safe</p>
                  <p className="text-sm text-muted-foreground">
                    This package does not exhibit malicious patterns.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

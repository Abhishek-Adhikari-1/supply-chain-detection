import { useAuthStore } from "@/store/useAuthStore";
import { useSocket } from "@/context/SocketContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, Wifi, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { isConnected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">Supply Chain Detection</h1>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                    <Wifi className="w-4 h-4" />
                    <span>Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                    <WifiOff className="w-4 h-4" />
                    <span>Disconnected</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground text-sm">
                Welcome, {user?.fullName}
              </span>
              <ThemeToggle />
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <h2 className="text-3xl font-bold mb-4">
            🎉 Welcome to Your Dashboard!
          </h2>
          <p className="text-muted-foreground text-lg">
            You are now authenticated. The dashboard features will be built
            here.
          </p>
        </div>
      </main>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Keyboard } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { keys: ["Ctrl", "K"], description: "Focus search input" },
    { keys: ["Ctrl", "E"], description: "Export current results as JSON" },
    { keys: ["Ctrl", "H"], description: "Go to scan history" },
    { keys: ["Esc"], description: "Close modals/dialogs" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-51 w-full max-w-lg animate-fade-up">
        <Card className="bg-linear-to-br from-slate-900 to-purple-900 border border-white/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="text-white/80">{shortcut.description}</span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, i) => (
                    <kbd
                      key={i}
                      className="px-2 py-1 text-xs font-semibold text-white bg-white/20 border border-white/30 rounded"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-white/50 text-center">
                Note: Use Cmd (⌘) instead of Ctrl on macOS
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

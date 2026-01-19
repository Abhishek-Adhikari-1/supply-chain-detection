import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface TourStore {
  isActive: boolean;
  currentStep: number;
  hasCompletedTour: boolean;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
}

const tourSteps: TourStep[] = [
  {
    target: "body",
    title: "Welcome to Supply Chain Guardian! 🛡️",
    content:
      "Let's take a quick tour to help you get started with securing your dependencies.",
    placement: "bottom",
  },
  {
    target: "[data-tour='search']",
    title: "Search for Packages",
    content:
      "Search for any npm or PyPI package by name. We'll analyze it for security threats in real-time.",
    placement: "bottom",
  },
  {
    target: "[data-tour='upload']",
    title: "Upload Dependency Files",
    content:
      "Drag & drop your package.json or requirements.txt to scan all your dependencies at once.",
    placement: "top",
  },
  {
    target: "[data-tour='analyze']",
    title: "Live Project Analysis",
    content:
      "Enter a local project path to analyze packages with real-time logs streamed via WebSocket.",
    placement: "top",
  },
  {
    target: "[data-tour='history']",
    title: "View History",
    content:
      "Access your scan history and export reports for compliance and auditing.",
    placement: "bottom",
  },
  {
    target: "[data-tour='compare']",
    title: "Compare Packages",
    content:
      "Compare multiple packages side-by-side to choose the safest option for your project.",
    placement: "bottom",
  },
  {
    target: "body",
    title: "Keyboard Shortcuts ⌨️",
    content:
      "Use Ctrl/Cmd + K to focus search, Ctrl/Cmd + E to export results, and Ctrl/Cmd + H for history.",
    placement: "bottom",
  },
];

export const useTourStore = create<TourStore>()(
  persist(
    (set, get) => ({
      isActive: false,
      currentStep: 0,
      hasCompletedTour: false,
      steps: tourSteps,

      startTour: () => set({ isActive: true, currentStep: 0 }),

      nextStep: () => {
        const { currentStep, steps } = get();
        if (currentStep < steps.length - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          get().completeTour();
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      skipTour: () => {
        set({ isActive: false, currentStep: 0, hasCompletedTour: true });
      },

      completeTour: () => {
        set({ isActive: false, currentStep: 0, hasCompletedTour: true });
      },

      resetTour: () => {
        set({ isActive: false, currentStep: 0, hasCompletedTour: false });
      },
    }),
    {
      name: "tour-storage",
    },
  ),
);

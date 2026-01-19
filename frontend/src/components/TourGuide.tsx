import { useEffect } from "react";
import { useTourStore } from "@/store/useTourStore";

export function TourGuide() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTour } =
    useTourStore();

  useEffect(() => {
    if (!isActive) return;

    const currentStepData = steps[currentStep];
    const targetElement = document.querySelector(currentStepData.target);

    if (targetElement && currentStepData.target !== "body") {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive, currentStep, steps]);

  if (!isActive) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[9998] animate-fade-in" />

      {/* Tour Card */}
      <div
        className="fixed z-[9999] max-w-md animate-fade-up"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="bg-gradient-to-br from-slate-900 to-purple-900 border border-white/20 rounded-2xl shadow-2xl p-6">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-all ${
                  index <= currentStep ? "bg-primary" : "bg-white/20"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-white/80">{currentStepData.content}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={skipTour}
              className="text-sm text-white/60 hover:text-white/80 transition-colors"
            >
              Skip Tour
            </button>
            <div className="flex gap-2">
              {!isFirstStep && (
                <button
                  onClick={prevStep}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                onClick={nextStep}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
              >
                {isLastStep ? "Get Started" : "Next"}
              </button>
            </div>
          </div>

          {/* Step Counter */}
          <div className="text-center mt-4 text-sm text-white/50">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
      </div>
    </>
  );
}

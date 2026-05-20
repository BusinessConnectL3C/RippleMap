import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "profile", label: "Profile" },
  { key: "arcgis-connect", label: "Connect ArcGIS" },
  { key: "group-join", label: "Join Group" },
  { key: "explore", label: "Explore" },
];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Onboarding progress" className="flex items-center justify-center gap-0">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
                  isCompleted && "border-[#1B4F72] bg-[#1B4F72] text-white",
                  isCurrent && "border-[#1B4F72] bg-white text-[#1B4F72]",
                  !isCompleted && !isCurrent && "border-gray-300 bg-white text-gray-400"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={cn(
                "text-xs",
                isCurrent ? "font-medium text-[#1B4F72]" : "text-gray-500"
              )}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                "mx-2 h-0.5 w-12 mb-5",
                index < currentStep ? "bg-[#1B4F72]" : "bg-gray-200"
              )} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, Lock, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingStep } from "@/lib/onboarding/steps";

interface Props {
  steps: OnboardingStep[];
  completedSteps: string[];
  arcgisConnected: boolean;
}

export function OnboardingChecklist({ steps, completedSteps, arcgisConnected }: Props) {
  const router = useRouter();
  const [completing, setCompleting] = useState<string | null>(null);

  const isComplete = (step: OnboardingStep) => {
    if (step.id === "arcgis_connect") return arcgisConnected;
    return completedSteps.includes(step.id);
  };

  const firstIncompleteIndex = steps.findIndex((s) => !isComplete(s));

  async function markComplete(stepId: string) {
    setCompleting(stepId);
    const res = await fetch("/api/onboarding/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: stepId }),
    });
    if (res.ok) {
      const { onboardingComplete } = await res.json();
      if (onboardingComplete) {
        router.push("/dashboard");
      } else {
        router.refresh();
      }
    }
    setCompleting(null);
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const done = isComplete(step);
        const isActive = index === firstIncompleteIndex;
        const isLocked = !done && index > firstIncompleteIndex;

        return (
          <div
            key={step.id}
            className={`rounded-lg border p-4 transition-colors ${
              done
                ? "border-green-200 bg-green-50"
                : isActive
                ? "border-[#1B4F72] bg-white shadow-sm"
                : "border-gray-200 bg-gray-50 opacity-60"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {done ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : isLocked ? (
                  <Lock className="h-5 w-5 text-gray-400" />
                ) : (
                  <Circle className="h-5 w-5 text-[#1B4F72]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium ${
                    done
                      ? "text-green-800 line-through"
                      : isActive
                      ? "text-gray-900"
                      : "text-gray-500"
                  }`}
                >
                  {index + 1}. {step.title}
                </p>

                {isActive && (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-gray-600">{step.description}</p>

                    <div className="flex flex-wrap gap-2">
                      {step.externalLink && (
                        <a
                          href={step.externalLink.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {step.externalLink.label}
                          </Button>
                        </a>
                      )}

                      {step.id === "arcgis_connect" && !arcgisConnected && (
                        <a href="/api/onboarding/link-arcgis">
                          <Button size="sm" className="bg-[#1B4F72] hover:bg-[#154060] gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Connect ArcGIS Account
                          </Button>
                        </a>
                      )}

                      {step.selfReport && (
                        <Button
                          size="sm"
                          className="bg-[#1B4F72] hover:bg-[#154060]"
                          disabled={completing === step.id}
                          onClick={() => markComplete(step.id)}
                        >
                          {completing === step.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : null}
                          Mark as complete
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

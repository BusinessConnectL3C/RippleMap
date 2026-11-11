"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, Lock, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteMembersDialog } from "@/components/account/InviteMembersDialog";
import type { OnboardingStep, StepId } from "@/lib/onboarding/steps";

interface PendingInvite {
  id: string;
  email: string | null;
  role: "ADMIN" | "MEMBER";
  expiresAt: string;
}

interface Props {
  steps: OnboardingStep[];
  completedSteps: StepId[];
  /** Owners and admins can invite; other members just continue. */
  canInvite: boolean;
  pendingInvites: PendingInvite[];
}

export function OnboardingChecklist({ steps, completedSteps, canInvite, pendingInvites }: Props) {
  const router = useRouter();
  const [completing, setCompleting] = useState<StepId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isComplete = (step: OnboardingStep) => completedSteps.includes(step.id);
  const firstIncompleteIndex = steps.findIndex((s) => !isComplete(s));

  async function markComplete(stepId: StepId) {
    setCompleting(stepId);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepId }),
      });
      if (!res.ok) {
        setError("Something went wrong saving that step. Please try again.");
        return;
      }
      const { onboardingComplete } = await res.json();
      if (onboardingComplete) {
        router.push("/dashboard");
      } else {
        router.refresh();
      }
    } catch {
      setError("Something went wrong saving that step. Please try again.");
    } finally {
      setCompleting(null);
    }
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
                ? "border-brand bg-white shadow-sm"
                : "border-gray-200 bg-gray-50 opacity-60"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {done ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : isLocked ? (
                  <Lock className="h-5 w-5 text-gray-600" />
                ) : (
                  <Circle className="h-5 w-5 text-brand" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium ${
                    done ? "text-green-800 line-through" : isActive ? "text-gray-900" : "text-gray-600"
                  }`}
                >
                  {index + 1}. {step.title}
                </p>

                {isActive && (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-gray-600">{step.description}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {step.id === "team" && canInvite && <InviteMembersDialog pendingInvites={pendingInvites} />}

                      {step.id === "esri" && (
                        <a href="/api/onboarding/link-arcgis">
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Connect ArcGIS account
                          </Button>
                        </a>
                      )}

                      <Button
                        size="sm"
                        variant={step.id === "team" && canInvite ? "outline" : "default"}
                        disabled={completing === step.id}
                        onClick={() => markComplete(step.id)}
                      >
                        {completing === step.id && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        {step.completeLabel}
                      </Button>
                    </div>

                    {step.id === "team" && canInvite && pendingInvites.length > 0 && (
                      <p className="text-xs text-gray-600">
                        {pendingInvites.length} invite{pendingInvites.length === 1 ? "" : "s"} pending.
                      </p>
                    )}
                    {error && (
                      <p className="text-sm text-red-700" role="alert">
                        {error}
                      </p>
                    )}
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

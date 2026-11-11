/**
 * Onboarding steps. Felt is the default map platform, so there is no longer a
 * TechSoup / Esri licensing track, and nonprofit and corporate orgs follow the
 * same steps. Every step is something the user can finish (or skip) on their
 * own: things BC staff set up — the Felt project, the first map, the Field
 * Editor seat — are shown as status on the onboarding page and never block
 * the user from reaching the portal.
 *
 * Legacy step ids from the Esri-era flow (techsoup, arcgis_apply, …) may still
 * be present in OnboardingState.completedSteps for older orgs; they're ignored.
 */
export type StepId = "team" | "esri" | "explore";

export interface OnboardingStep {
  id: StepId;
  title: string;
  description: string;
  /** Label for the button that completes the step. */
  completeLabel: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "team",
    title: "Invite your team",
    description:
      "Add the people in your organization who need to see your maps and dashboards. You can also do this later from Account.",
    completeLabel: "Continue",
  },
  {
    id: "esri",
    title: "Do you also use ArcGIS?",
    description:
      "RippleMap maps run on Felt, so no ArcGIS account is needed. If your organization still has Survey123 forms, Field Maps, or hosted layers in ArcGIS Online, connect your ArcGIS account to see them here too.",
    completeLabel: "We don't use ArcGIS",
  },
  {
    id: "explore",
    title: "Explore RippleMap",
    description:
      "You're set. Your maps and dashboards appear under Maps & Apps as BC adds them, and Support is there if you need anything.",
    completeLabel: "Go to my dashboard",
  },
];

export function isStepId(value: unknown): value is StepId {
  return ONBOARDING_STEPS.some((s) => s.id === value);
}

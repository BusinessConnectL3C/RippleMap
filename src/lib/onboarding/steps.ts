export type StepId =
  | "techsoup"
  | "arcgis_apply"
  | "arcgis_activate"
  | "arcgis_trial"
  | "arcgis_purchase"
  | "arcgis_connect";

export interface OnboardingStep {
  id: StepId;
  title: string;
  description: string;
  note?: string;
  externalLink?: { label: string; href: string };
  selfReport: boolean;
}

export const NONPROFIT_STEPS: OnboardingStep[] = [
  {
    id: "techsoup",
    title: "Sign up for TechSoup",
    description:
      "TechSoup validates your nonprofit status for Esri's nonprofit program. Create a free TechSoup account to get started.",
    externalLink: {
      label: "Go to TechSoup",
      href: "https://www.techsoup.org/joining-techsoup/registration",
    },
    selfReport: true,
  },
  {
    id: "arcgis_apply",
    title: "Apply for ArcGIS Nonprofit Program",
    description:
      "Submit your application through Esri using your TechSoup credentials. Acceptance typically arrives via email within a few business days.",
    externalLink: {
      label: "Apply at Esri",
      href: "https://www.esri.com/en-us/industries/nonprofit/nonprofit-program",
    },
    selfReport: true,
  },
  {
    id: "arcgis_activate",
    title: "Create your ArcGIS org and purchase licenses",
    description:
      "After receiving your acceptance email, create your ArcGIS organization and purchase user licenses ($100/user). Each user must log in at least once to activate their account.",
    selfReport: true,
  },
  {
    id: "arcgis_connect",
    title: "Connect your ArcGIS account to RippleMap",
    description:
      "Link your ArcGIS Online account so RippleMap can access your maps and FieldMaps forms. BC will add your organization to the shared group after you connect.",
    selfReport: false,
  },
];

export const CORPORATE_STEPS: OnboardingStep[] = [
  {
    id: "arcgis_trial",
    title: "Sign up for ArcGIS Online",
    description:
      "Start with a 21-day free trial to get your ArcGIS organization set up before purchasing.",
    externalLink: {
      label: "Start free trial",
      href: "https://www.esri.com/en-us/arcgis/products/arcgis-online/trial",
    },
    selfReport: true,
  },
  {
    id: "arcgis_purchase",
    title: "Purchase user licenses",
    description:
      "Purchase the user types your team needs through your ArcGIS account. Each user must log in at least once to activate their account.",
    selfReport: true,
  },
  {
    id: "arcgis_connect",
    title: "Connect your ArcGIS account to RippleMap",
    description:
      "Link your ArcGIS Online account so RippleMap can access your maps and FieldMaps forms. BC will add your organization to the shared group after you connect.",
    selfReport: false,
  },
];

export function getStepsForOrgType(
  type: "NONPROFIT" | "CORPORATE"
): OnboardingStep[] {
  return type === "NONPROFIT" ? NONPROFIT_STEPS : CORPORATE_STEPS;
}

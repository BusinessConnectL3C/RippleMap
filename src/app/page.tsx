import Link from "next/link";
import { Barlow_Condensed, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import InquiryForm from "@/components/InquiryForm";

const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  variable: "--font-body",
  display: "swap",
});
const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "RippleMap — GIS Client Portal",
  description:
    "Access your ArcGIS maps, field surveys, support, and billing through your organization's dedicated portal.",
};

const FEATURES = [
  {
    symbol: "⬡",
    title: "Interactive Maps",
    body: "Browse every ArcGIS Online map your organization owns. Filter by date or type, then open any map directly from your portal.",
  },
  {
    symbol: "⊞",
    title: "FieldMaps Forms",
    body: "Your field crews collect data in ArcGIS FieldMaps. Every completed survey lands here, organized and ready to review.",
  },
  {
    symbol: "◈",
    title: "Dedicated Workspace",
    body: "Each organization gets its own private ArcGIS group. Your maps, your data, your access list — isolated from every other client.",
  },
  {
    symbol: "◎",
    title: "Direct Support",
    body: "Open a ticket, track its status, and communicate with BC's GIS specialists without leaving your portal.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Request Access",
    body: "Tell us about your organization. We confirm fit and provision your RippleMap account within one business day.",
  },
  {
    n: "02",
    title: "Connect ArcGIS",
    body: "Link your ArcGIS Online org with one click. We create a private group for your data — no manual console work required.",
  },
  {
    n: "03",
    title: "Your Team Is Live",
    body: "Invite staff, assign maps to crews, and collect field data. Everything syncs back to your portal in real time.",
  },
];

export default function LandingPage() {
  return (
    <>
      <style>{`
        :root {
          --rm-ground:  #0A1929;
          --rm-surface: #EEF4F8;
          --rm-text-dk: #E8F2F8;
          --rm-text-lt: #0A1929;
          --rm-accent:  #00B4C8;
          --rm-cta:     #F4A825;
          --rm-brand:   #1B4F72;
        }

        .rm-d { font-family: var(--font-display), sans-serif; }
        .rm-b { font-family: var(--font-body), sans-serif; }
        .rm-m { font-family: var(--font-mono), monospace; }

        @keyframes rm-ring {
          0%   { transform: translate(-50%, -50%) scale(0.12); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(5.5);  opacity: 0; }
        }

        .rm-ring {
          position: absolute;
          left: 50%; top: 42%;
          width: 280px; height: 280px;
          border-radius: 50%;
          border: 1.5px solid var(--rm-accent);
          animation: rm-ring 6s ease-out infinite;
          pointer-events: none;
        }
        .rm-ring:nth-child(1) { animation-delay: 0s;   }
        .rm-ring:nth-child(2) { animation-delay: 1.5s; }
        .rm-ring:nth-child(3) { animation-delay: 3s;   }
        .rm-ring:nth-child(4) { animation-delay: 4.5s; }

        @media (prefers-reduced-motion: reduce) {
          .rm-ring { animation: none; opacity: 0.1; }
          .rm-ring:nth-child(1) { transform: translate(-50%,-50%) scale(1);   }
          .rm-ring:nth-child(2) { transform: translate(-50%,-50%) scale(2.2); }
          .rm-ring:nth-child(3) { transform: translate(-50%,-50%) scale(3.4); }
          .rm-ring:nth-child(4) { transform: translate(-50%,-50%) scale(4.5); }
        }

        .rm-feature-card {
          background: #ffffff;
          border-top: 3px solid var(--rm-brand);
          border-radius: 2px;
        }

        .rm-cta-btn {
          background: var(--rm-cta);
          color: var(--rm-ground);
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-radius: 4px;
          padding: 0.875rem 2.25rem;
          font-size: 1.125rem;
          display: inline-block;
          transition: filter 0.15s;
        }
        .rm-cta-btn:hover { filter: brightness(1.1); }

        .rm-outline-btn {
          border: 1.5px solid rgba(232,242,248,0.3);
          color: var(--rm-text-dk);
          font-family: var(--font-body), sans-serif;
          border-radius: 4px;
          padding: 0.875rem 2.25rem;
          font-size: 1rem;
          display: inline-block;
          transition: background 0.15s;
        }
        .rm-outline-btn:hover { background: rgba(255,255,255,0.08); }
      `}</style>

      <div className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} rm-b`}>

        {/* NAV */}
        <nav
          style={{ background: "var(--rm-ground)" }}
          className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-14"
        >
          <div className="flex items-center gap-3">
            <div
              style={{ background: "var(--rm-accent)" }}
              className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
            >
              <span className="rm-d text-sm font-bold text-white">R</span>
            </div>
            <span style={{ color: "var(--rm-text-dk)" }} className="rm-d text-lg font-bold uppercase tracking-widest">
              RippleMap
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#inquiry"
              style={{ color: "var(--rm-accent)" }}
              className="rm-b text-sm font-semibold hover:underline hidden sm:block"
            >
              Request Access
            </a>
            <Link href="/login" className="rm-outline-btn !py-2 !px-5 !text-sm">
              Sign In
            </Link>
          </div>
        </nav>

        {/* HERO */}
        <section
          style={{ background: "var(--rm-ground)" }}
          className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24 text-center"
        >
          <div className="rm-ring" aria-hidden="true" />
          <div className="rm-ring" aria-hidden="true" />
          <div className="rm-ring" aria-hidden="true" />
          <div className="rm-ring" aria-hidden="true" />

          {/* Origin dot */}
          <div
            style={{
              background: "var(--rm-accent)",
              boxShadow: "0 0 0 8px rgba(0,180,200,0.15), 0 0 0 16px rgba(0,180,200,0.07)",
            }}
            className="relative z-10 mb-14 h-3.5 w-3.5 rounded-full"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-4xl">
            <p
              style={{ color: "var(--rm-accent)" }}
              className="rm-m text-xs uppercase tracking-widest mb-5"
            >
              ArcGIS Online · FieldMaps · Client Portal
            </p>
            <h1
              style={{ color: "var(--rm-text-dk)", lineHeight: 0.92 }}
              className="rm-d text-6xl font-extrabold uppercase sm:text-[7rem] mb-7"
            >
              Every Map.<br />
              Every Survey.<br />
              One Place.
            </h1>
            <p
              style={{ color: "rgba(232,242,248,0.65)" }}
              className="rm-b text-lg font-light max-w-xl mx-auto mb-11 leading-relaxed sm:text-xl"
            >
              RippleMap gives your organization a dedicated portal for your ArcGIS maps,
              FieldMaps field data, support tickets, and billing — without touching the
              ArcGIS admin console.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a href="#inquiry" className="rm-cta-btn">
                Request Access
              </a>
              <Link href="/login" className="rm-outline-btn">
                Sign In →
              </Link>
            </div>
          </div>

          <p
            style={{ color: "rgba(232,242,248,0.18)" }}
            className="rm-m absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs"
            aria-hidden="true"
          >
            38.9072° N · 77.0369° W · EPSG:4326
          </p>
        </section>

        {/* FEATURES */}
        <section style={{ background: "var(--rm-surface)" }} className="px-6 py-24 sm:px-14">
          <div className="mx-auto max-w-5xl">
            <p
              style={{ color: "var(--rm-brand)" }}
              className="rm-m text-xs uppercase tracking-widest mb-3"
            >
              What&apos;s included
            </p>
            <h2
              style={{ color: "var(--rm-text-lt)", lineHeight: 1.05 }}
              className="rm-d text-4xl font-extrabold uppercase sm:text-5xl mb-16 max-w-lg"
            >
              Everything your GIS team needs in one portal
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="rm-feature-card p-8 shadow-sm">
                  <span
                    style={{ color: "var(--rm-accent)", fontSize: "1.4rem" }}
                    className="mb-5 block"
                    aria-hidden="true"
                  >
                    {f.symbol}
                  </span>
                  <h3
                    style={{ color: "var(--rm-text-lt)" }}
                    className="rm-d text-xl font-bold uppercase mb-3"
                  >
                    {f.title}
                  </h3>
                  <p style={{ color: "#4A5568" }} className="rm-b text-sm leading-relaxed">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section style={{ background: "#ffffff" }} className="px-6 py-24 sm:px-14">
          <div className="mx-auto max-w-5xl">
            <p
              style={{ color: "var(--rm-brand)" }}
              className="rm-m text-xs uppercase tracking-widest mb-3"
            >
              Getting started
            </p>
            <h2
              style={{ color: "var(--rm-text-lt)", lineHeight: 1.05 }}
              className="rm-d text-4xl font-extrabold uppercase sm:text-5xl mb-16"
            >
              From request to field-ready
            </h2>
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="flex flex-col gap-4">
                  <span
                    style={{
                      color: "var(--rm-accent)",
                      borderBottom: "1.5px solid var(--rm-accent)",
                      paddingBottom: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                    className="rm-m text-sm inline-block"
                  >
                    {s.n}
                  </span>
                  <h3
                    style={{ color: "var(--rm-text-lt)", lineHeight: 1.1 }}
                    className="rm-d text-2xl font-bold uppercase"
                  >
                    {s.title}
                  </h3>
                  <p style={{ color: "#4A5568" }} className="rm-b text-sm leading-relaxed">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INQUIRY */}
        <section id="inquiry" style={{ background: "var(--rm-ground)" }} className="px-6 py-24 sm:px-14">
          <div className="mx-auto max-w-2xl">
            <p
              style={{ color: "var(--rm-accent)" }}
              className="rm-m text-xs uppercase tracking-widest mb-3"
            >
              Get started
            </p>
            <h2
              style={{ color: "var(--rm-text-dk)", lineHeight: 1.05 }}
              className="rm-d text-4xl font-extrabold uppercase sm:text-5xl mb-4"
            >
              Request access for your organization
            </h2>
            <p style={{ color: "rgba(232,242,248,0.55)" }} className="rm-b text-base mb-10">
              Already have an account?{" "}
              <Link
                href="/login"
                style={{ color: "var(--rm-accent)" }}
                className="hover:underline"
              >
                Sign in here.
              </Link>
            </p>
            <InquiryForm />
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            background: "#060E16",
            borderTop: "1px solid rgba(232,242,248,0.07)",
          }}
          className="px-6 py-10 sm:px-14"
        >
          <div className="mx-auto max-w-5xl flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  style={{ background: "var(--rm-accent)" }}
                  className="h-6 w-6 rounded flex items-center justify-center"
                >
                  <span className="rm-d text-xs font-bold text-white">R</span>
                </div>
                <span
                  style={{ color: "var(--rm-text-dk)" }}
                  className="rm-d text-sm font-semibold uppercase tracking-widest"
                >
                  RippleMap
                </span>
              </div>
              <p style={{ color: "rgba(232,242,248,0.3)" }} className="rm-m text-xs">
                A Business Connect L3C product
              </p>
            </div>
            <div className="flex gap-8">
              <Link
                href="/login"
                style={{ color: "rgba(232,242,248,0.45)" }}
                className="rm-b text-sm hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                style={{ color: "rgba(232,242,248,0.45)" }}
                className="rm-b text-sm hover:text-white transition-colors"
              >
                Register
              </Link>
              <a
                href="#inquiry"
                style={{ color: "rgba(232,242,248,0.45)" }}
                className="rm-b text-sm hover:text-white transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

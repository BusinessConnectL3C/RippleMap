import Link from "next/link";
import { Logo } from "@/components/ui/logo";

/** href: null renders plain (non-interactive) text for items with no destination yet. */
const COLUMNS: Record<string, { label: string; href: string | null }[]> = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Plans", href: "/#plans" },
  ],
  Company: [
    { label: "Contact us", href: "/contact" },
  ],
  Account: [
    { label: "Sign in", href: "/login" },
    { label: "Create an account", href: "/register" },
    { label: "Support", href: "/support" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-card px-6 pb-8 pt-12 sm:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/">
            <Logo type="secondary" tone="black" height={20} trim />
          </Link>
          <p className="mt-3.5 max-w-[260px] text-sm leading-relaxed text-text-muted">
            Helping organizations understand, measure, and communicate their real-world impact.
          </p>
        </div>
        {Object.entries(COLUMNS).map(([heading, items]) => (
          <div key={heading}>
            <p className="rm-eyebrow mb-3.5">{heading}</p>
            <div className="flex flex-col gap-2.5">
              {items.map(({ label, href }) => {
                if (!href) {
                  return (
                    <span key={label} className="text-sm text-text-muted">
                      {label}
                    </span>
                  );
                }
                const className = "text-sm text-text-secondary hover:text-text-primary";
                return href.startsWith("http") ? (
                  <a key={label} href={href} className={className} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                ) : (
                  <Link key={label} href={href} className={className}>
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-7 flex max-w-6xl justify-between border-t border-border pt-5 text-[13px] text-text-muted">
        <span>&copy; {new Date().getFullYear()} Business Connect L3C. All rights reserved.</span>
        <span>A Business Connect L3C product</span>
      </div>
    </footer>
  );
}

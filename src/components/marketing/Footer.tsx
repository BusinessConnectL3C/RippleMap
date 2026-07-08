import { Logo } from "@/components/ui/logo";

const COLUMNS: Record<string, string[]> = {
  Product: ["Features", "Map explorer", "Network", "Pricing"],
  Company: ["About", "Impact", "Careers", "Contact"],
  Resources: ["Docs", "Guides", "Support", "Status"],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-card px-6 pb-8 pt-12 sm:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo type="secondary" tone="black" height={24} />
          <p className="mt-3.5 max-w-[260px] text-sm leading-relaxed text-text-muted">
            Helping organizations understand, measure, and communicate their real-world impact.
          </p>
        </div>
        {Object.entries(COLUMNS).map(([heading, items]) => (
          <div key={heading}>
            <p className="rm-eyebrow mb-3.5">{heading}</p>
            <div className="flex flex-col gap-2.5">
              {items.map((item) => (
                <a key={item} href="#" className="text-sm text-text-secondary hover:text-text-primary">
                  {item}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-7 flex max-w-6xl justify-between border-t border-border pt-5 text-[13px] text-text-muted">
        <span>&copy; {new Date().getFullYear()} RippleMap. All rights reserved.</span>
        <span className="flex gap-4">
          <a href="#" className="text-text-muted hover:text-text-secondary">Privacy</a>
          <a href="#" className="text-text-muted hover:text-text-secondary">Terms</a>
        </span>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "Product", href: "#features" },
  { label: "Impact", href: "#impact" },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 flex items-center gap-7 border-b border-border bg-white/85 px-6 py-4 backdrop-blur-md sm:px-12">
      <Link href="/" className="shrink-0">
        <Logo type="secondary" tone="black" height={26} />
      </Link>
      <div className="ml-3 hidden gap-6 md:flex">
        {LINKS.map(({ label, href }) => (
          <a key={label} href={href} className="text-[15px] font-medium text-text-secondary hover:text-text-primary">
            {label}
          </a>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-11 px-4" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button size="sm" className="h-11 px-4" asChild>
          <Link href="/register">Get started</Link>
        </Button>
      </div>
    </nav>
  );
}

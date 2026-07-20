import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:px-12">
      <div className="relative overflow-hidden rounded-2xl bg-brand-hover px-8 py-14 text-center sm:px-12">
        <div
          className="absolute inset-0 opacity-50"
          aria-hidden="true"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />
        <div className="relative">
          <h2 className="mx-auto max-w-xl text-3xl text-white sm:text-4xl">Ready to map your impact?</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/85">
            Join the organizations bringing clarity to complex work. See RippleMap in action.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button variant="accent" size="lg" asChild>
              <Link href="/register">Get started</Link>
            </Button>
            <Button variant="outline" size="lg" className="border-white/40 bg-transparent text-white hover:bg-white/10" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

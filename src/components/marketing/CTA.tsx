import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RingField } from "@/components/marketing/RingField";

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:px-12">
      <div className="relative overflow-hidden rounded-2xl bg-[var(--green-600)] px-8 py-14 text-center sm:px-12">
        <RingField color="rgba(255,255,255,0.6)" opacity={0.16} />
        <div className="relative">
          <h2 className="mx-auto max-w-xl text-3xl tracking-[-0.02em] text-white sm:text-4xl">
            Ready to see your impact clearly?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/85">
            Join the organizations bringing calm to complex work. See RippleMap map your world
            in one call.
          </p>
          <div className="mt-[30px] flex flex-wrap justify-center gap-3">
            <Button variant="accent" size="lg" asChild>
              <Link href="/register">Get started</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white/45 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

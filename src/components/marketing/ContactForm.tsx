"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTACT_INTERESTS, CONTACT_ORG_TYPES } from "@/lib/contact-options";

type State = { step: "idle" } | { step: "sending" } | { step: "sent" } | { step: "error"; message: string; field?: string };

export function ContactForm() {
  const shownAt = useRef<number>(0);
  const [state, setState] = useState<State>({ step: "idle" });
  const [orgType, setOrgType] = useState("");
  const [interest, setInterest] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();
    setState({ step: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: text("name"),
          email: text("email"),
          organization: text("organization"),
          website: text("website") || undefined,
          role: text("role") || undefined,
          orgType: orgType || undefined,
          interest: interest || undefined,
          message: text("message") || undefined,
          company: text("company") || undefined,
          elapsedMs: shownAt.current ? Date.now() - shownAt.current : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ step: "error", message: data?.error ?? "Something went wrong. Please try again.", field: data?.field });
        return;
      }
      setState({ step: "sent" });
    } catch {
      setState({ step: "error", message: "We couldn't send that. Check your connection and try again." });
    }
  }

  if (state.step === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
        <CheckCircle2 className="h-10 w-10 text-[var(--success)]" aria-hidden="true" />
        <p className="font-display text-xl font-bold text-text-primary">Thanks, we&apos;ve got your message.</p>
        <p className="max-w-sm text-sm text-text-secondary">Someone from our team will reply by email, usually within two business days.</p>
      </div>
    );
  }

  const sending = state.step === "sending";
  const invalid = (field: string) => (state.step === "error" && state.field === field ? true : undefined);

  return (
    <form
      onSubmit={onSubmit}
      onFocus={() => {
        if (!shownAt.current) shownAt.current = Date.now();
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Name *</Label>
          <Input id="contact-name" name="name" autoComplete="name" required maxLength={120} disabled={sending} aria-invalid={invalid("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Work email *</Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={200} disabled={sending} aria-invalid={invalid("email")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-org">Organization *</Label>
          <Input id="contact-org" name="organization" autoComplete="organization" required maxLength={200} disabled={sending} aria-invalid={invalid("organization")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-website">Website</Label>
          <Input id="contact-website" name="website" type="url" inputMode="url" autoComplete="url" placeholder="example.org" maxLength={300} disabled={sending} aria-invalid={invalid("website")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-role">Your role</Label>
          <Input id="contact-role" name="role" autoComplete="organization-title" placeholder="e.g. Program director" maxLength={120} disabled={sending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-org-type">Organization type</Label>
          <Select value={orgType} onValueChange={setOrgType} disabled={sending}>
            <SelectTrigger id="contact-org-type">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_ORG_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-interest">What are you interested in?</Label>
        <Select value={interest} onValueChange={setInterest} disabled={sending}>
          <SelectTrigger id="contact-interest">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_INTERESTS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea id="contact-message" name="message" rows={4} maxLength={4000} placeholder="Tell us about your work and what you'd like to map." disabled={sending} />
      </div>

      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.step === "error" && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-muted sm:max-w-xs">
          We use these details only to reply to you, and delete them after 24 months. Please don&apos;t include
          sensitive personal information.
        </p>
        <Button type="submit" size="lg" disabled={sending} className="shrink-0">
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {sending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}

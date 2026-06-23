"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  organization: z.string().min(2, "Enter your organization name"),
  email: z.string().email("Enter a valid email address"),
  message: z.string().min(10, "Tell us a little more (at least 10 characters)"),
});

type FormData = z.infer<typeof schema>;

export default function InquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setSubmitted(true);
    } else {
      setServerError("Something went wrong. Try again or email us directly.");
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          border: "1.5px solid rgba(0,180,200,0.4)",
          borderRadius: "4px",
          padding: "2rem",
        }}
      >
        <p
          style={{ color: "#00B4C8", fontFamily: "var(--font-mono, monospace)", fontSize: "0.75rem" }}
          className="uppercase tracking-widest mb-3"
        >
          Inquiry received
        </p>
        <p
          style={{ color: "#E8F2F8", fontFamily: "var(--font-display, sans-serif)", fontSize: "1.5rem", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1 }}
          className="mb-3"
        >
          We&apos;ll be in touch within one business day.
        </p>
        <p style={{ color: "rgba(232,242,248,0.55)", fontSize: "0.875rem" }}>
          In the meantime, you can{" "}
          <a href="/register" style={{ color: "#00B4C8" }} className="hover:underline">
            create your account
          </a>{" "}
          to get a head start.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <input
            id="name"
            type="text"
            placeholder="Jane Smith"
            autoComplete="name"
            {...register("name")}
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </Field>
        <Field label="Organization" htmlFor="organization" error={errors.organization?.message}>
          <input
            id="organization"
            type="text"
            placeholder="Acme County GIS"
            autoComplete="organization"
            {...register("organization")}
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </Field>
      </div>

      <Field label="Work email" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          placeholder="you@yourorg.gov"
          autoComplete="email"
          {...register("email")}
          style={inputStyle}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
      </Field>

      <Field label="Tell us about your project" htmlFor="message" error={errors.message?.message}>
        <textarea
          id="message"
          rows={4}
          placeholder="What kinds of maps or field surveys are you managing? Any current pain points?"
          {...register("message")}
          style={{ ...inputStyle, resize: "vertical" }}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
      </Field>

      {serverError && (
        <p
          style={{ color: "#F87171", fontSize: "0.875rem" }}
          role="alert"
        >
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          background: isSubmitting ? "rgba(244,168,37,0.5)" : "#F4A825",
          color: "#0A1929",
          fontFamily: "var(--font-display, sans-serif)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderRadius: "4px",
          padding: "0.9rem 2rem",
          fontSize: "1rem",
          border: "none",
          cursor: isSubmitting ? "not-allowed" : "pointer",
          transition: "filter 0.15s",
          alignSelf: "flex-start",
        }}
      >
        {isSubmitting ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        style={{
          color: "rgba(232,242,248,0.7)",
          fontSize: "0.8rem",
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <p style={{ color: "#F87171", fontSize: "0.8rem" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(232,242,248,0.06)",
  border: "1px solid rgba(232,242,248,0.2)",
  borderRadius: "4px",
  color: "#E8F2F8",
  padding: "0.75rem 1rem",
  fontSize: "0.95rem",
  width: "100%",
  outline: "none",
  fontFamily: "var(--font-body, sans-serif)",
  transition: "border-color 0.15s",
};

function focusStyle(e: React.FocusEvent<HTMLElement>) {
  (e.target as HTMLElement).style.borderColor = "#00B4C8";
}

function blurStyle(e: React.FocusEvent<HTMLElement>) {
  (e.target as HTMLElement).style.borderColor = "rgba(232,242,248,0.2)";
}

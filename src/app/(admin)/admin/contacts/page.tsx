import { connection } from "next/server";
import { db } from "@/lib/db";
import { CONTACT_RETENTION_MONTHS, purgeOldContacts } from "@/lib/contact";
import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";
import { ContactRowActions } from "@/components/admin/ContactRowActions";

export default async function AdminContactsPage() {
  // Request-time only: never run the purge or read PII during a build.
  await connection();
  await purgeOldContacts().catch((err) => console.error("contact: purge failed", err));
  const contacts = await db.contactSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const newCount = contacts.filter((c) => c.status === "NEW").length;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Contacts" />
      <div className="flex-1 space-y-3 p-6">
        <p className="text-sm text-text-secondary">
          Messages from the website contact form{newCount ? ` (${newCount} new)` : ""}. These contain personal
          information: use them only to reply. They&apos;re deleted automatically after {CONTACT_RETENTION_MONTHS}{" "}
          months; delete one sooner if someone asks.
        </p>

        {contacts.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-card p-8 text-center text-sm text-text-secondary">
            No messages yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {contacts.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-surface-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                      {c.name}
                      {c.status === "NEW" && <Badge variant="brand">New</Badge>}
                    </p>
                    <p className="text-sm text-text-secondary">
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                      {" · "}
                      {c.organization}
                      {c.website && (
                        <>
                          {" · "}
                          <a href={c.website} target="_blank" rel="noopener noreferrer nofollow">
                            {c.website.replace(/^https?:\/\//, "")}
                          </a>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">
                      {[c.role, c.orgType, c.interest].filter(Boolean).join(" · ")}
                      {(c.role || c.orgType || c.interest) && " · "}
                      <LocalTime iso={c.createdAt.toISOString()} />
                    </p>
                  </div>
                  <ContactRowActions id={c.id} status={c.status} name={c.name} />
                </div>
                {c.message && (
                  <p className="mt-3 whitespace-pre-wrap border-l-2 border-[var(--brand-border)] pl-3 text-sm text-text-primary">
                    {c.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

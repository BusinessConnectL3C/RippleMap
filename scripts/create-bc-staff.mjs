#!/usr/bin/env node
/**
 * Create (or promote) a BC staff / system-admin account.
 *
 *   npm run staff:create -- --email someone@ripplemap.app --name "Full Name"
 *
 * Why a script and not the registration form: registration has no email
 * verification, so granting BC_STAFF based on an email address or domain would
 * let anyone who types that address get cross-tenant admin access. BC_STAFF is
 * deliberately not grantable from the admin UI either (see
 * src/app/api/admin/users/[id]/route.ts) — it can only be granted by someone
 * with database credentials running this script.
 *
 * Staff accounts live in a dedicated internal organization ("Business Connect
 * L3C — Staff"), not a client org, and creating one does NOT create an ArcGIS
 * group, ClickUp list, or Felt project.
 *
 * The password is read from a hidden prompt (or STAFF_PASSWORD for
 * non-interactive use). It is never passed on the command line, so it doesn't
 * end up in shell history.
 *
 * Requires DATABASE_URL (loaded from .env if present).
 */
import "dotenv/config";
import readline from "node:readline";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const STAFF_ORG_NAME = "Business Connect L3C — Staff";

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      // Echo only the prompt itself, not the typed characters.
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
    },
  });

  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: npm run staff:create -- --email <email> --name "<full name>"');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existing = await db.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role === "BC_STAFF") {
        console.log(`${email} is already BC staff. Nothing to do.`);
        return;
      }
      // Promote in place. The user stays in their current org; warn, because a
      // staff account normally shouldn't also be a client org member.
      await db.user.update({ where: { id: existing.id }, data: { role: "BC_STAFF" } });
      console.log(`Promoted existing user ${email} to BC_STAFF (org ${existing.orgId}).`);
      console.log("Note: this user is still a member of that org. If it was created by the public");
      console.log("registration form just to get access, delete that org instead and re-run this script.");
      console.log("The user must sign out and back in for the new role to take effect.");
      return;
    }

    const name = values.name?.trim();
    if (!name || name.length < 2) {
      console.error('--name is required when creating a new staff account.');
      process.exit(1);
    }

    const password = process.env.STAFF_PASSWORD ?? (await promptHidden("Password (min 12 chars): "));
    if (password.length < 12) {
      console.error("Password must be at least 12 characters.");
      process.exit(1);
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    // Reuse the staff org if one exists; otherwise create it with onboarding
    // already completed so the portal layout doesn't redirect staff into the
    // client onboarding flow.
    let org = await db.organization.findFirst({ where: { name: STAFF_ORG_NAME } });
    if (!org) {
      org = await db.organization.create({
        data: {
          name: STAFF_ORG_NAME,
          type: "CORPORATE",
          onboardingState: { create: { currentStep: 0, completedSteps: [], completed: true } },
        },
      });
      console.log(`Created internal staff organization (${org.id}).`);
    }

    const user = await db.user.create({
      data: { email, name, hashedPassword, role: "BC_STAFF", orgId: org.id },
    });
    console.log(`Created BC_STAFF account ${email} (${user.id}).`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

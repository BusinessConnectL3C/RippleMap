/**
 * Provisions a RippleMap account for a customer who already exists in a
 * BC-owned shared ArcGIS group. Skips group creation; sets arcgisGroupId
 * directly. Onboarding is seeded at the arcgis-connect step so the user
 * completes OAuth on first login.
 *
 * Usage:
 *   EMAIL=client@example.com \
 *   TEMP_PASSWORD=ChangeMe123! \
 *   ARCGIS_GROUP_ID=abc123 \
 *   ORG_NAME="Acme Corp" \
 *   CLIENT_NAME="Jane Smith" \
 *   npx tsx scripts/setup-customer.ts
 *
 * DATABASE_URL must also be set (or present in .env.local).
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local if present (local dev), then .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
dotenv.config();

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function require_env(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

async function main() {
  const email        = require_env("EMAIL");
  const tempPassword = require_env("TEMP_PASSWORD");
  const arcgisGroupId = require_env("ARCGIS_GROUP_ID");
  const orgName      = require_env("ORG_NAME");
  const clientName   = require_env("CLIENT_NAME");
  const databaseUrl  = require_env("DATABASE_URL");

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      console.error(`User with email ${email} already exists (id: ${existing.id}). Aborting.`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await db.user.create({
      data: {
        email,
        name: clientName,
        hashedPassword,
        orgName,
        arcgisGroupId,
        onboardingState: {
          create: {
            currentStep: 1,          // arcgis-connect
            completedSteps: ["profile"],
            completed: false,
          },
        },
      },
    });

    console.log("✓ User created");
    console.log(`  id:            ${user.id}`);
    console.log(`  email:         ${user.email}`);
    console.log(`  name:          ${user.name}`);
    console.log(`  orgName:       ${user.orgName}`);
    console.log(`  arcgisGroupId: ${user.arcgisGroupId}`);
    console.log(`  onboarding:    currentStep=1 (arcgis-connect), completedSteps=["profile"]`);
    console.log();
    console.log("Next step: have the client log in and complete the ArcGIS OAuth connect step.");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

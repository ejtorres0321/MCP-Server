import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

// Load .env.local from web-app directory
const envLocalPath = resolve(__dirname, "../.env.local");
const envPath = resolve(__dirname, "../.env");

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.error("No .env.local or .env file found in packages/web-app/");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@manuelsolis.com";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeThisPassword123!";

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env.local");
  process.exit(1);
}

// Define User schema inline (cannot import from src due to path aliases)
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isApproved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Define MfaCode schema for TTL index creation
const mfaCodeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, max: 5 },
  },
  { timestamps: true }
);

const MfaCode = mongoose.model("MfaCode", mfaCodeSchema);

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected!\n");

  // Ensure indexes
  console.log("Ensuring indexes...");
  await User.syncIndexes();
  await MfaCode.syncIndexes();
  console.log("Indexes created.\n");

  // Check if admin already exists
  const existing = await User.findOne({ email: SEED_ADMIN_EMAIL });

  if (existing) {
    console.log(`Admin user already exists: ${SEED_ADMIN_EMAIL}`);
    console.log(`  Role: ${existing.role}`);
    console.log(`  Approved: ${existing.isApproved}`);
    console.log("\nNo changes made.");
  } else {
    const hashedPassword = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);

    await User.create({
      email: SEED_ADMIN_EMAIL,
      password: hashedPassword,
      name: "Administrator",
      role: "admin",
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: "seed-script",
    });

    console.log("Admin user created:");
    console.log(`  Email: ${SEED_ADMIN_EMAIL}`);
    console.log(`  Password: ${SEED_ADMIN_PASSWORD}`);
    console.log(`  Role: admin`);
    console.log(`  Approved: true`);
    console.log("\n*** IMPORTANT: Change the admin password after first login! ***");
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});

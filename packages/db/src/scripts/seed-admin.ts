/**
 * Seed script for creating the initial admin user
 *
 * Usage:
 *   INITIAL_ADMIN_EMAIL=admin@example.com INITIAL_ADMIN_PASSWORD=temppassword bun run src/scripts/seed-admin.ts
 *
 * Or set these in .env:
 *   INITIAL_ADMIN_EMAIL=admin@regain.local
 *   INITIAL_ADMIN_PASSWORD=<secure-password>
 */

import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { eq } from 'drizzle-orm';
import { account, createDB, user } from '../index';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/popper';
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD;

// better-auth scrypt config
const scryptConfig = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
};

/**
 * Hash password using scrypt (matching better-auth's format)
 * Format: salt:key (both hex encoded)
 */
async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToHex(saltBytes);

  const key = await scryptAsync(password.normalize('NFKC'), salt, {
    N: scryptConfig.N,
    r: scryptConfig.r,
    p: scryptConfig.p,
    dkLen: scryptConfig.dkLen,
    maxmem: 128 * scryptConfig.N * scryptConfig.r * 2,
  });

  return `${salt}:${bytesToHex(key)}`;
}

function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Error: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set');
    console.error('');
    console.error('Usage:');
    console.error(
      '  INITIAL_ADMIN_EMAIL=admin@example.com INITIAL_ADMIN_PASSWORD=password bun run src/scripts/seed-admin.ts',
    );
    process.exit(1);
  }

  console.log('Connecting to database...');
  const db = createDB(DATABASE_URL);

  // Check if user already exists (using better-auth's user table)
  const existing = await db.query.user.findFirst({
    where: eq(user.email, ADMIN_EMAIL.toLowerCase()),
  });

  if (existing) {
    console.log(`User with email ${ADMIN_EMAIL} already exists.`);
    console.log('To reset password, use the admin panel or delete the user first.');
    process.exit(0);
  }

  // Hash password using better-auth's format
  console.log('Hashing password...');
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const userId = generateId();
  const accountId = generateId();

  // Create admin user in better-auth user table
  console.log('Creating admin user...');
  const [createdUser] = await db
    .insert(user)
    .values({
      id: userId,
      email: ADMIN_EMAIL.toLowerCase(),
      name: 'Admin',
      role: 'admin',
      emailVerified: true,
    })
    .returning();

  // Create account with password (better-auth stores passwords in account table)
  console.log('Creating account with credentials...');
  await db.insert(account).values({
    id: accountId,
    accountId: userId,
    providerId: 'credential',
    userId: userId,
    password: passwordHash,
  });

  console.log('');
  console.log('Admin user created successfully!');
  console.log(`  ID: ${createdUser.id}`);
  console.log(`  Email: ${createdUser.email}`);
  console.log(`  Role: ${createdUser.role}`);
  console.log('');
  console.log('You can now log in at /login with these credentials.');

  process.exit(0);
}

main().catch((error) => {
  console.error('Error seeding admin:', error);
  process.exit(1);
});

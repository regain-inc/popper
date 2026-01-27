/**
 * Seed script for creating the initial admin user
 *
 * Usage:
 *   INITIAL_ADMIN_EMAIL=admin@example.com INITIAL_ADMIN_PASSWORD=temppassword bun run src/scripts/seed-admin.ts
 *
 * Or set these in .env:
 *   INITIAL_ADMIN_EMAIL=admin@regain.health
 *   INITIAL_ADMIN_PASSWORD=<secure-password>
 */

import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { createDB, users } from '../index';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/popper';
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD;
const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
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

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, ADMIN_EMAIL.toLowerCase()),
  });

  if (existing) {
    console.log(`User with email ${ADMIN_EMAIL} already exists.`);
    console.log('To reset password, use the admin panel or delete the user first.');
    process.exit(0);
  }

  // Hash password
  console.log('Hashing password...');
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  // Create admin user
  console.log('Creating admin user...');
  const [user] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      name: 'Admin',
      role: 'admin',
      isActive: true,
    })
    .returning();

  console.log('');
  console.log('Admin user created successfully!');
  console.log(`  ID: ${user.id}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Role: ${user.role}`);
  console.log('');
  console.log('You can now log in at /login with these credentials.');

  process.exit(0);
}

main().catch((error) => {
  console.error('Error seeding admin:', error);
  process.exit(1);
});

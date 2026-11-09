import bcrypt from "bcryptjs";
import { sql } from "../src/lib/db";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 12) {
  console.error("Usage: npm run create-user -- you@example.com 'a-password-of-12+-chars'");
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
await sql`INSERT INTO users (email, password_hash) VALUES (${email.toLowerCase()}, ${hash})
          ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`;
console.log(`User ${email} ready`);
await sql.end();

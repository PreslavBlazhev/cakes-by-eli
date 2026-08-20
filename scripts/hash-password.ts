import "./_bootstrap";

import { hashPassword } from "@/lib/password";

/**
 * Turns a plain password into an ADMIN_PASSWORD_HASH value.
 *
 *   npm run admin:hash -- "my-strong-password"
 *
 * The plain password is never written to disk or to the database.
 */
async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Употреба: npm run admin:hash -- "вашата-парола"');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  console.log("\nДобавете това в .env.local (в кавички):\n");
  console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

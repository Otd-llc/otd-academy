// One-off: create the read-only reporting role on Neon production and write its
// URL into both .env.local files. The password is generated here, sent to
// Postgres and written to the two files; it is never printed.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';

const ROLE = 'foundry_report';
const ENV_FILES = ['C:/zzz/project-foundry/.env.local', 'C:/zzz/pf-launch-v2/.env.local'];

config({ path: ENV_FILES[0], quiet: true });
const owner = process.env.PROD_DIRECT_URL;
if (!owner || new URL(owner).username !== 'neondb_owner') {
  console.log('PROD_DIRECT_URL missing or not the owner role');
  process.exit(2);
}
const ownerUrl = new URL(owner);
console.log('owner host', ownerUrl.hostname, 'db', ownerUrl.pathname.slice(1));

// URL-safe alphabet only, so the connection string needs no percent-encoding.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const bytes = randomBytes(40);
const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');

const c = new pg.Client({ connectionString: owner });
await c.connect();
try {
  const exists = await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROLE]);
  if (exists.rowCount) {
    console.log(`${ROLE} already exists; rotating its password instead of creating it`);
    await c.query(`ALTER ROLE ${ROLE} WITH LOGIN PASSWORD ${c.escapeLiteral(password)}`);
  } else {
    await c.query(`CREATE ROLE ${ROLE} WITH LOGIN PASSWORD ${c.escapeLiteral(password)}`);
    console.log(`created ${ROLE}`);
  }
  for (const sql of [
    `GRANT CONNECT ON DATABASE neondb TO ${ROLE}`,
    `GRANT USAGE ON SCHEMA public TO ${ROLE}`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE}`,
    `GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT ON TABLES TO ${ROLE}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${ROLE}`,
    `ALTER ROLE ${ROLE} SET default_transaction_read_only = on`,
  ]) {
    await c.query(sql);
    console.log('ok ', sql);
  }
  const check = await c.query(
    `SELECT (SELECT count(*) FROM information_schema.table_privileges WHERE grantee=$1 AND privilege_type='SELECT' AND table_schema='public') AS selects,
            (SELECT count(*) FROM information_schema.table_privileges WHERE grantee=$1 AND privilege_type<>'SELECT') AS non_selects,
            (SELECT rolconfig::text FROM pg_roles WHERE rolname=$1) AS rolconfig`,
    [ROLE],
  );
  console.log('verify', JSON.stringify(check.rows[0]));
} finally {
  await c.end();
}

// Pooled host for the RO url: the PROD_DATABASE_URL host (…-pooler…), same db.
const pooled = new URL(process.env.PROD_DATABASE_URL);
const roUrl = `postgresql://${ROLE}:${password}@${pooled.hostname}${pooled.pathname}?sslmode=require&channel_binding=require`;
for (const f of ENV_FILES) {
  let s = readFileSync(f, 'utf8');
  const re = /^PROD_RO_DATABASE_URL=.*$/m;
  if (!re.test(s)) {
    console.log(`no PROD_RO_DATABASE_URL line in ${f}`);
    process.exit(3);
  }
  s = s.replace(re, `PROD_RO_DATABASE_URL="${roUrl}"`);
  writeFileSync(f, s, 'utf8');
  console.log('wrote', f);
}

// Prove the new login reads and cannot write.
const ro = new pg.Client({ connectionString: roUrl });
await ro.connect();
const who = await ro.query("SELECT current_user, current_setting('transaction_read_only') AS ro");
console.log('login ok', JSON.stringify(who.rows[0]));
try {
  await ro.query('UPDATE "User" SET email = email WHERE false');
  console.log('WRITE ALLOWED <-- NOT READ-ONLY');
  process.exitCode = 4;
} catch (e) {
  console.log('write refused:', e.message);
}
await ro.end();
console.log('done');

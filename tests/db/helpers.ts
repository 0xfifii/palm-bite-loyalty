import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { createQrToken } from "@/lib/qr/token";

export const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Run `npm run db:test:setup` against a local PostgreSQL, then set TEST_DATABASE_URL to the palm_bite_test database.",
  );
}

export const pool = new Pool({ connectionString: url, max: 20 });

type Json = Record<string, unknown>;

/** Runs fn inside a transaction as the given API role and user. */
export async function as<T>(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role } : { role }),
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function rpc(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<Json> {
  return as(role, userId, async (c) => {
    const { rows } = await c.query(sql, params);
    const first = rows[0];
    return (first ? Object.values(first)[0] : null) as Json;
  });
}

export async function createUser(
  opts: { role?: "customer" | "staff" | "admin"; name?: string; phone?: string | null } = {},
) {
  const id = randomUUID();
  const email = `user-${id.slice(0, 8)}@example.test`;
  const phone =
    opts.phone === undefined ? `+234${Math.floor(7000000000 + Math.random() * 999999999)}` : opts.phone;
  await pool.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    JSON.stringify({ full_name: opts.name ?? "Test Customer", phone }),
  ]);
  if (opts.role && opts.role !== "customer") {
    await pool.query("update public.profiles set role = $2 where id = $1", [id, opts.role]);
  }
  return { id, email, phone };
}

export async function account(customerId: string) {
  const { rows } = await pool.query("select * from public.loyalty_accounts where customer_id = $1", [customerId]);
  return rows[0];
}

/** Creates a QR session through the real staff function. Returns the token parts. */
export async function issueQr(staffId: string) {
  const t = createQrToken(TEST_SECRET, LOCATION_ID);
  const res = await rpc("authenticated", staffId, "select public.create_qr_session($1, $2)", [
    t.sessionId,
    t.tokenHash,
  ]);
  if (res.code !== "OK") throw new Error(`create_qr_session failed: ${JSON.stringify(res)}`);
  return t;
}

/** Raw customer scan: creates a pending visit request (no point yet). */
export async function requestScan(customerId: string, qr: { sessionId: string; tokenHash: string }, idem = randomUUID()) {
  return rpc(
    "service_role",
    null,
    "select public.request_qr_visit($1, $2, $3, $4, $5)",
    [customerId, qr.sessionId, qr.tokenHash, LOCATION_ID, idem],
  );
}

export async function decide(staffId: string, requestId: unknown, approve = true) {
  return rpc("authenticated", staffId, "select public.staff_decide_visit($1, $2)", [requestId, approve]);
}

let approverId: string | null = null;
async function approver() {
  if (!approverId) approverId = (await createUser({ role: "staff", name: "Approver", phone: null })).id;
  return approverId;
}

/**
 * Full visit: the customer scans, a Palm Staff member approves. Returns the
 * approval result when the scan was accepted, otherwise the scan result.
 */
export async function scan(customerId: string, qr: { sessionId: string; tokenHash: string }, idem = randomUUID()) {
  const r = await requestScan(customerId, qr, idem);
  if (r.code !== "APPROVAL_PENDING") return r;
  return decide(await approver(), r.request_id, true);
}

/**
 * Simulates the passing of business days by moving this customer's existing
 * visits back in time. Bypasses the append-only trigger (test only).
 */
export async function shiftVisitsBack(customerId: string, days: number) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local session_replication_role = replica");
    // Oldest first so the one-visit-per-day constraint never sees a collision.
    const { rows } = await client.query(
      "select id from public.visits where customer_id = $1 order by visit_date asc",
      [customerId],
    );
    for (const row of rows) {
      await client.query("update public.visits set visit_date = visit_date - $2::int where id = $1", [
        row.id,
        days,
      ]);
    }
    await client.query("commit");
  } finally {
    client.release();
  }
}

/** Gives a customer n points by approving n visits on n distinct past days. */
export async function earnPoints(customerId: string, staffId: string, n: number) {
  for (let i = 0; i < n; i++) {
    const qr = await issueQr(staffId);
    const r = await scan(customerId, qr);
    if (r.code !== "POINT_AWARDED") throw new Error(`earnPoints failed at ${i}: ${JSON.stringify(r)}`);
    await shiftVisitsBack(customerId, 1);
  }
}

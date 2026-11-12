import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LOCATION_ID,
  TEST_SECRET,
  account,
  as,
  createUser,
  earnPoints,
  issueQr,
  pool,
  rpc,
  scan,
  requestScan,
  decide,
  shiftVisitsBack,
} from "./helpers";
import { createQrToken } from "@/lib/qr/token";

let staff: { id: string };
let admin: { id: string };
let drinkId: string;
let ineligibleDrinkId: string;

beforeAll(async () => {
  staff = await createUser({ role: "staff", name: "Staff Member" });
  admin = await createUser({ role: "admin", name: "Admin User", phone: null });
  // Test drinks of our own, so the tests do not depend on the live menu.
  const { rows } = await pool.query(
    `insert into public.drinks (name, is_reward_eligible, customization) values
       ('Test Reward Drink', true, '[{"name":"Milk","options":["Whole","Oat"],"multi":false}]'),
       ('Test Paid Drink', false, '[]')
     returning id, is_reward_eligible`,
  );
  drinkId = rows.find((r) => r.is_reward_eligible).id;
  ineligibleDrinkId = rows.find((r) => !r.is_reward_eligible).id;
});

afterAll(async () => {
  await pool.end();
});

async function rewardFor(customerId: string) {
  const { rows } = await pool.query(
    "select * from public.rewards where customer_id = $1 order by cycle_number",
    [customerId],
  );
  return rows;
}

async function requestRedemption(customerId: string) {
  const [reward] = (await rewardFor(customerId)).filter((r) => r.status === "available");
  const res = await rpc("authenticated", customerId, "select public.select_reward_drink($1, $2, $3)", [
    reward.id,
    drinkId,
    JSON.stringify({ Milk: "Oat" }),
  ]);
  return { reward, res };
}

describe("registration", () => {
  it("1 and 2: new customers start with zero points and registration awards nothing", async () => {
    const c = await createUser();
    const a = await account(c.id);
    expect(a.current_points).toBe(0);
    expect(a.cycle_number).toBe(1);
    expect(a.total_visits).toBe(0);
    const { rows } = await pool.query("select count(*)::int as n from public.loyalty_transactions where customer_id = $1", [c.id]);
    expect(rows[0].n).toBe(0);
    const { rows: p } = await pool.query("select role from public.profiles where id = $1", [c.id]);
    expect(p[0].role).toBe("customer");
  });

  it("metadata cannot grant a role", async () => {
    const id = randomUUID();
    await pool.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      `sneaky-${id.slice(0, 6)}@example.test`,
      JSON.stringify({ full_name: "Sneaky", role: "admin" }),
    ]);
    const { rows } = await pool.query("select role from public.profiles where id = $1", [id]);
    expect(rows[0].role).toBe("customer");
  });

  it("prevents duplicate phone numbers", async () => {
    const c = await createUser();
    await expect(createUser({ phone: c.phone })).rejects.toThrow(/duplicate key/);
  });
});

describe("visit QR scanning", () => {
  it("3: a valid QR scan awards exactly one point", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    const res = await scan(c.id, qr);
    expect(res.code).toBe("POINT_AWARDED");
    expect((res.account as { points: number }).points).toBe(1);
    expect((await account(c.id)).current_points).toBe(1);
    const { rows } = await pool.query("select * from public.loyalty_transactions where customer_id = $1", [c.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("visit");
  });

  it("4: repeated same-day scans award no additional points", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    expect((await scan(c.id, qr)).code).toBe("POINT_AWARDED");
    expect((await scan(c.id, qr)).code).toBe("ALREADY_COLLECTED_TODAY");
    const qr2 = await issueQr(staff.id);
    expect((await scan(c.id, qr2)).code).toBe("ALREADY_COLLECTED_TODAY");
    expect((await account(c.id)).current_points).toBe(1);
  });

  it("5: a later business day awards another point", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    expect((await scan(c.id, qr)).code).toBe("POINT_AWARDED");
    await shiftVisitsBack(c.id, 1);
    expect((await scan(c.id, await issueQr(staff.id))).code).toBe("POINT_AWARDED");
    expect((await account(c.id)).current_points).toBe(2);
  });

  it("6: expired QR codes are rejected", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    await pool.query(
      "update public.qr_sessions set issued_at = now() - interval '5 minutes', expires_at = now() - interval '1 second' where id = $1",
      [qr.sessionId],
    );
    expect((await scan(c.id, qr)).code).toBe("QR_EXPIRED");
    expect((await account(c.id)).current_points).toBe(0);
  });

  it("7: tampered or unknown tokens are rejected", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    const wrongHash = { sessionId: qr.sessionId, tokenHash: "0".repeat(64) };
    expect((await scan(c.id, wrongHash)).code).toBe("QR_INVALID");
    const unknown = createQrToken(TEST_SECRET, LOCATION_ID);
    expect((await scan(c.id, unknown)).code).toBe("QR_INVALID");
    const wrongLocation = await rpc("service_role", null, "select public.request_qr_visit($1,$2,$3,$4,$5)", [
      c.id,
      qr.sessionId,
      qr.tokenHash,
      randomUUID(),
      randomUUID(),
    ]);
    expect(wrongLocation.code).toBe("QR_INVALID");
    expect((await account(c.id)).current_points).toBe(0);
  });

  it("8: revoked QR codes are rejected", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    const rev = await rpc("authenticated", admin.id, "select public.revoke_qr_sessions($1, $2)", [
      qr.sessionId,
      "Photo shared online",
    ]);
    expect(rev.code).toBe("OK");
    expect((await scan(c.id, qr)).code).toBe("QR_REVOKED");
    expect((await account(c.id)).current_points).toBe(0);
  });

  it("only staff can mint QR sessions and only admins can revoke", async () => {
    const c = await createUser();
    const t = createQrToken(TEST_SECRET, LOCATION_ID);
    const res = await rpc("authenticated", c.id, "select public.create_qr_session($1, $2)", [t.sessionId, t.tokenHash]);
    expect(res.code).toBe("FORBIDDEN");
    const rev = await rpc("authenticated", staff.id, "select public.revoke_qr_sessions(null, 'x')");
    expect(rev.code).toBe("FORBIDDEN");
  });

  it("9: unauthenticated and customer roles cannot call the award function", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    await expect(
      rpc("anon", null, "select public.request_qr_visit($1,$2,$3,$4,$5)", [c.id, qr.sessionId, qr.tokenHash, LOCATION_ID, randomUUID()]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      rpc("authenticated", c.id, "select public.request_qr_visit($1,$2,$3,$4,$5)", [c.id, qr.sessionId, qr.tokenHash, LOCATION_ID, randomUUID()]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      rpc("authenticated", c.id, "select public._award_point($1, $2, null, 'staff_assisted', $1, null, null)", [c.id, LOCATION_ID]),
    ).rejects.toThrow(/permission denied/);
    expect((await account(c.id)).current_points).toBe(0);
  });

  it("idempotent retries return the committed result without a second award", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    const key = randomUUID();
    const first = await scan(c.id, qr, key);
    expect(first.code).toBe("POINT_AWARDED");
    expect(first.replayed).toBe(false);
    // The code expires before the client's retry arrives.
    await pool.query(
      "update public.qr_sessions set issued_at = now() - interval '5 minutes', expires_at = now() - interval '1 second' where id = $1",
      [qr.sessionId],
    );
    const retry = await requestScan(c.id, qr, key);
    expect(retry.code).toBe("POINT_AWARDED");
    expect((await account(c.id)).current_points).toBe(1);
  });

  it("17: concurrent scans and approvals cannot award duplicate points", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    const scans = await Promise.all(Array.from({ length: 12 }, () => requestScan(c.id, qr)));
    expect(scans.every((r) => r.code === "APPROVAL_PENDING")).toBe(true);
    expect(new Set(scans.map((r) => r.request_id)).size).toBe(1);
    const staff2 = await createUser({ role: "staff" });
    const decisions = await Promise.all(
      Array.from({ length: 8 }, (_, i) => decide(i % 2 ? staff.id : staff2.id, scans[0].request_id, true)),
    );
    expect(decisions.filter((r) => r.code === "POINT_AWARDED")).toHaveLength(1);
    expect(decisions.filter((r) => r.code === "ALREADY_DECIDED")).toHaveLength(7);
    expect((await account(c.id)).current_points).toBe(1);
    const { rows } = await pool.query("select count(*)::int n from public.visits where customer_id = $1", [c.id]);
    expect(rows[0].n).toBe(1);
  });

  it("suspended customers cannot earn points", async () => {
    const c = await createUser();
    const res = await rpc("authenticated", admin.id, "select public.admin_set_account_status($1, 'suspended', $2)", [
      c.id,
      "Investigating abuse",
    ]);
    expect(res.code).toBe("OK");
    const qr = await issueQr(staff.id);
    expect((await scan(c.id, qr)).code).toBe("ACCOUNT_SUSPENDED");
  });

  it("logs every verification attempt", async () => {
    const c = await createUser();
    const qr = await issueQr(staff.id);
    await scan(c.id, qr);
    await scan(c.id, qr);
    const { rows } = await pool.query(
      "select result_code from public.scan_attempts where customer_id = $1 order by id",
      [c.id],
    );
    expect(rows.map((r) => r.result_code)).toEqual(["APPROVAL_PENDING", "ALREADY_COLLECTED_TODAY"]);
  });
});

describe("staff-assisted check-in", () => {
  it("staff can check in a customer once per day; customers cannot", async () => {
    const c = await createUser();
    const other = await createUser();
    const denied = await rpc("authenticated", other.id, "select public.staff_check_in($1, $2)", [c.id, "self"]);
    expect(denied.code).toBe("FORBIDDEN");
    const ok = await rpc("authenticated", staff.id, "select public.staff_check_in($1, $2)", [c.id, "Phone camera broken"]);
    expect(ok.code).toBe("POINT_AWARDED");
    const again = await rpc("authenticated", staff.id, "select public.staff_check_in($1, $2)", [c.id, null]);
    expect(again.code).toBe("ALREADY_COLLECTED_TODAY");
    const { rows } = await pool.query("select method, recorded_by from public.visits where customer_id = $1", [c.id]);
    expect(rows[0].method).toBe("staff_assisted");
    expect(rows[0].recorded_by).toBe(staff.id);
  });
});

describe("rewards", () => {
  it("11 and 12: fifteen points create exactly one reward and block further points", async () => {
    const c = await createUser();
    await earnPoints(c.id, staff.id, 14);
    expect(await rewardFor(c.id)).toHaveLength(0);
    const qr = await issueQr(staff.id);
    const fifteenth = await scan(c.id, qr);
    expect(fifteenth.code).toBe("POINT_AWARDED");
    expect(fifteenth.reward_unlocked).toBe(true);
    const rewards = await rewardFor(c.id);
    expect(rewards).toHaveLength(1);
    expect(rewards[0].status).toBe("available");
    expect(rewards[0].cycle_number).toBe(1);

    await shiftVisitsBack(c.id, 1);
    const blocked = await scan(c.id, await issueQr(staff.id));
    expect(blocked.code).toBe("REWARD_PENDING_REDEMPTION");
    expect((await account(c.id)).current_points).toBe(15);
    expect(await rewardFor(c.id)).toHaveLength(1);

    // The database itself refuses a second reward for the same cycle.
    await expect(
      pool.query("insert into public.rewards (customer_id, cycle_number, reference) values ($1, 1, 'RW-DUPLICATE')", [c.id]),
    ).rejects.toThrow(/duplicate key/);
  });

  it("customers can choose only eligible drinks with valid options, once", async () => {
    const c = await createUser();
    await earnPoints(c.id, staff.id, 15);
    const [reward] = await rewardFor(c.id);

    const ineligible = await rpc("authenticated", c.id, "select public.select_reward_drink($1, $2, '{}')", [reward.id, ineligibleDrinkId]);
    expect(ineligible.code).toBe("DRINK_NOT_ELIGIBLE");
    const badOption = await rpc("authenticated", c.id, "select public.select_reward_drink($1, $2, $3)", [
      reward.id,
      drinkId,
      JSON.stringify({ Milk: "Gold" }),
    ]);
    expect(badOption.code).toBe("INVALID_CUSTOMIZATION");

    const other = await createUser();
    const notMine = await rpc("authenticated", other.id, "select public.select_reward_drink($1, $2, '{}')", [reward.id, drinkId]);
    expect(notMine.code).toBe("REWARD_NOT_FOUND");

    const ok = await rpc("authenticated", c.id, "select public.select_reward_drink($1, $2, $3)", [
      reward.id,
      drinkId,
      JSON.stringify({ Milk: "Oat" }),
    ]);
    expect(ok.code).toBe("REDEMPTION_REQUESTED");
    expect(ok.reference).toMatch(/^PB-[0-9A-Z]{6}$/);
    const twice = await rpc("authenticated", c.id, "select public.select_reward_drink($1, $2, '{}')", [reward.id, drinkId]);
    expect(twice.code).toBe("REWARD_NOT_AVAILABLE");
  });

  it("customers cannot complete their own redemption", async () => {
    const c = await createUser();
    await earnPoints(c.id, staff.id, 15);
    const { res } = await requestRedemption(c.id);
    const self = await rpc("authenticated", c.id, "select public.complete_redemption($1)", [res.reference]);
    expect(self.code).toBe("FORBIDDEN");
    expect((await account(c.id)).current_points).toBe(15);
  });

  it("13, 14 and 16: redemption resets to zero, keeps history and starts a new cycle", async () => {
    const c = await createUser();
    await earnPoints(c.id, staff.id, 15);
    const { reward, res } = await requestRedemption(c.id);

    const lookup = await rpc("authenticated", staff.id, "select public.lookup_redemption($1)", [String(res.reference).toLowerCase()]);
    expect(lookup.code).toBe("OK");

    const done = await rpc("authenticated", staff.id, "select public.complete_redemption($1)", [res.reference]);
    expect(done.code).toBe("REDEMPTION_COMPLETED");

    const a = await account(c.id);
    expect(a.current_points).toBe(0);
    expect(a.cycle_number).toBe(2);
    expect(a.rewards_redeemed).toBe(1);
    expect(a.total_visits).toBe(15);

    const { rows: visits } = await pool.query("select count(*)::int n from public.visits where customer_id = $1", [c.id]);
    expect(visits[0].n).toBe(15);
    const { rows: tx } = await pool.query(
      "select type, points_delta, balance_after from public.loyalty_transactions where customer_id = $1 order by created_at, type",
      [c.id],
    );
    expect(tx.filter((t) => t.type === "visit")).toHaveLength(15);
    const reset = tx.find((t) => t.type === "redemption_reset");
    expect(reset).toMatchObject({ points_delta: -15, balance_after: 0 });

    const { rows: rw } = await pool.query("select status, redeemed_at from public.rewards where id = $1", [reward.id]);
    expect(rw[0].status).toBe("redeemed");
    const { rows: rd } = await pool.query("select status, completed_by, drink_name from public.redemptions where reference = $1", [res.reference]);
    expect(rd[0]).toMatchObject({ status: "completed", completed_by: staff.id });

    // New cycle: the customer can collect again on a later day.
    await shiftVisitsBack(c.id, 1);
    const qr = await issueQr(staff.id);
    const next = await scan(c.id, qr);
    expect(next.code).toBe("POINT_AWARDED");
    expect((await account(c.id)).current_points).toBe(1);
    const { rows: cycleVisit } = await pool.query(
      "select cycle_number from public.visits where customer_id = $1 order by created_at desc limit 1",
      [c.id],
    );
    expect(cycleVisit[0].cycle_number).toBe(2);
  });

  it("15: failed redemption attempts preserve the reward and points", async () => {
    const c = await createUser();
    await earnPoints(c.id, staff.id, 15);
    const { reward, res } = await requestRedemption(c.id);

    const missing = await rpc("authenticated", staff.id, "select public.complete_redemption('PB-ZZZZZZ')");
    expect(missing.code).toBe("REDEMPTION_NOT_FOUND");

    // A redemption that errors midway must roll back completely.
    await expect(
      as("authenticated", staff.id, async (cl) => {
        await cl.query("select public.complete_redemption($1)", [res.reference]);
        throw new Error("simulated failure after completion call");
      }),
    ).rejects.toThrow(/simulated failure/);

    expect((await account(c.id)).current_points).toBe(15);
    const { rows } = await pool.query("select status from public.rewards where id = $1", [reward.id]);
    expect(rows[0].status).toBe("pending");

    // Staff cancellation returns the reward to available without destroying it.
    const cancel = await rpc("authenticated", staff.id, "select public.cancel_redemption($1, $2)", [res.reference, "Customer changed mind"]);
    expect(cancel.code).toBe("REDEMPTION_CANCELLED");
    const { rows: after } = await pool.query("select status from public.rewards where id = $1", [reward.id]);
    expect(after[0].status).toBe("available");
    expect((await account(c.id)).current_points).toBe(15);
    const cancelledComplete = await rpc("authenticated", staff.id, "select public.complete_redemption($1)", [res.reference]);
    expect(cancelledComplete.code).toBe("REDEMPTION_CANCELLED");
  });

  it("18: concurrent redemptions cannot process the same reward twice", async () => {
    const c = await createUser();
    await earnPoints(c.id, staff.id, 15);
    const { res } = await requestRedemption(c.id);
    const staff2 = await createUser({ role: "staff" });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        rpc("authenticated", i % 2 ? staff.id : staff2.id, "select public.complete_redemption($1)", [res.reference]),
      ),
    );
    expect(results.filter((r) => r.code === "REDEMPTION_COMPLETED")).toHaveLength(1);
    expect(results.filter((r) => r.code === "ALREADY_REDEEMED")).toHaveLength(7);
    const a = await account(c.id);
    expect(a.current_points).toBe(0);
    expect(a.cycle_number).toBe(2);
    expect(a.rewards_redeemed).toBe(1);
  });

  it("administrators can void an open reward with a reason; history is kept", async () => {
    const c = await createUser();
    await earnPoints(c.id, staff.id, 15);
    const [reward] = await rewardFor(c.id);
    const noReason = await rpc("authenticated", admin.id, "select public.admin_cancel_reward($1, '')", [reward.id]);
    expect(noReason.code).toBe("REASON_REQUIRED");
    const ok = await rpc("authenticated", admin.id, "select public.admin_cancel_reward($1, $2)", [reward.id, "Fraudulent visits confirmed"]);
    expect(ok.code).toBe("OK");
    const a = await account(c.id);
    expect(a).toMatchObject({ current_points: 0, cycle_number: 2 });
    const [after] = await rewardFor(c.id);
    expect(after.status).toBe("cancelled");
  });
});

describe("Palm Staff approval", () => {
  it("no point is added until a Palm Staff member approves", async () => {
    const c = await createUser();
    const r = await requestScan(c.id, await issueQr(staff.id));
    expect(r.code).toBe("APPROVAL_PENDING");
    expect((await account(c.id)).current_points).toBe(0);
    const ok = await decide(staff.id, r.request_id, true);
    expect(ok.code).toBe("POINT_AWARDED");
    expect((await account(c.id)).current_points).toBe(1);
    const { rows } = await pool.query("select status, decided_by, visit_id from public.visit_requests where id = $1", [r.request_id]);
    expect(rows[0]).toMatchObject({ status: "approved", decided_by: staff.id });
    expect(rows[0].visit_id).toBeTruthy();
  });

  it("each code works for one Palm Fren only", async () => {
    const a = await createUser();
    const b = await createUser();
    const qr = await issueQr(staff.id);
    expect((await requestScan(a.id, qr)).code).toBe("APPROVAL_PENDING");
    expect((await requestScan(b.id, qr)).code).toBe("QR_USED");
    const { rows } = await pool.query("select consumed_by from public.qr_sessions where id = $1", [qr.sessionId]);
    expect(rows[0].consumed_by).toBe(a.id);
  });

  it("customers cannot approve their own visit", async () => {
    const c = await createUser();
    const r = await requestScan(c.id, await issueQr(staff.id));
    expect((await decide(c.id, r.request_id, true)).code).toBe("FORBIDDEN");
    await expect(
      rpc("authenticated", c.id, "select public.request_qr_visit($1,$2,$3,$4,$5)", [c.id, randomUUID(), "0".repeat(64), LOCATION_ID, randomUUID()]),
    ).rejects.toThrow(/permission denied/);
    expect((await account(c.id)).current_points).toBe(0);
  });

  it("a declined visit adds nothing and the guest can scan a new code", async () => {
    const c = await createUser();
    const r = await requestScan(c.id, await issueQr(staff.id));
    expect((await decide(staff.id, r.request_id, false)).code).toBe("VISIT_DECLINED");
    expect((await account(c.id)).current_points).toBe(0);
    const again = await requestScan(c.id, await issueQr(staff.id));
    expect(again.code).toBe("APPROVAL_PENDING");
  });

  it("requests lapse after 15 minutes", async () => {
    const c = await createUser();
    const r = await requestScan(c.id, await issueQr(staff.id));
    await pool.query("update public.visit_requests set created_at = now() - interval '16 minutes' where id = $1", [r.request_id]);
    expect((await decide(staff.id, r.request_id, true)).code).toBe("REQUEST_EXPIRED");
    expect((await account(c.id)).current_points).toBe(0);
  });

  it("customers see only their own requests; staff see all", async () => {
    const a = await createUser();
    const b = await createUser();
    await requestScan(a.id, await issueQr(staff.id));
    await requestScan(b.id, await issueQr(staff.id));
    const mine = await as("authenticated", a.id, (cl) => cl.query("select customer_id from public.visit_requests"));
    expect(mine.rows.every((r) => r.customer_id === a.id)).toBe(true);
    const all = await as("authenticated", staff.id, (cl) => cl.query("select customer_id from public.visit_requests where customer_id = any($1)", [[a.id, b.id]]));
    expect(all.rows).toHaveLength(2);
  });
});

describe("Palm Staff sign-up requests", () => {
  async function signUp(type: string) {
    const id = randomUUID();
    await pool.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      `req-${id.slice(0, 8)}@example.test`,
      JSON.stringify({ full_name: "Staff Hopeful", account_type: type }),
    ]);
    const { rows } = await pool.query("select role, staff_request from public.profiles where id = $1", [id]);
    return { id, ...rows[0] };
  }

  it("choosing Palm Staff creates a request but no staff access", async () => {
    const u = await signUp("staff");
    expect(u).toMatchObject({ role: "customer", staff_request: "pending" });
    const fren = await signUp("fren");
    expect(fren).toMatchObject({ role: "customer", staff_request: null });
  });

  it("only an admin can approve, which grants staff access", async () => {
    const u = await signUp("staff");
    expect((await rpc("authenticated", staff.id, "select public.admin_decide_staff_request($1, true)", [u.id])).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", u.id, "select public.admin_decide_staff_request($1, true)", [u.id])).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", admin.id, "select public.admin_decide_staff_request($1, true)", [u.id])).code).toBe("OK");
    const { rows } = await pool.query("select role, staff_request from public.profiles where id = $1", [u.id]);
    expect(rows[0]).toMatchObject({ role: "staff", staff_request: "approved" });
  });

  it("a declined request keeps the account as a Palm Fren", async () => {
    const u = await signUp("staff");
    expect((await rpc("authenticated", admin.id, "select public.admin_decide_staff_request($1, false)", [u.id])).code).toBe("OK");
    const { rows } = await pool.query("select role, staff_request from public.profiles where id = $1", [u.id]);
    expect(rows[0]).toMatchObject({ role: "customer", staff_request: "declined" });
  });
});

describe("access control", () => {
  it("10: customers cannot edit their own balance or loyalty records", async () => {
    const c = await createUser();
    await expect(
      rpc("authenticated", c.id, "update public.loyalty_accounts set current_points = 15 where customer_id = $1", [c.id]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      rpc("authenticated", c.id, "insert into public.visits (customer_id, location_id, method, visit_date, business_timezone, cycle_number, recorded_by) values ($1, $2, 'staff_assisted', current_date, 'UTC', 1, $1)", [c.id, LOCATION_ID]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      rpc("authenticated", c.id, "insert into public.rewards (customer_id, cycle_number, reference) values ($1, 1, 'RW-HACKED00')", [c.id]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      rpc("authenticated", c.id, "update public.profiles set role = 'admin' where id = $1", [c.id]),
    ).rejects.toThrow(/permission denied/);
    // Permitted profile fields can be edited.
    await rpc("authenticated", c.id, "update public.profiles set full_name = 'New Name' where id = $1", [c.id]);
    const { rows } = await pool.query("select full_name, role from public.profiles where id = $1", [c.id]);
    expect(rows[0]).toMatchObject({ full_name: "New Name", role: "customer" });
    expect((await account(c.id)).current_points).toBe(0);
  });

  it("customers cannot adjust points through admin functions", async () => {
    const c = await createUser();
    const res = await rpc("authenticated", c.id, "select public.admin_adjust_points($1, 15, 'please give me points')", [c.id]);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("19: customers cannot read another customer's information", async () => {
    const a = await createUser();
    const b = await createUser();
    const qr = await issueQr(staff.id);
    await scan(b.id, qr);
    const seen = await as("authenticated", a.id, async (cl) => {
      const profiles = await cl.query("select id from public.profiles");
      const accounts = await cl.query("select customer_id from public.loyalty_accounts");
      const visits = await cl.query("select id from public.visits where customer_id = $1", [b.id]);
      const tx = await cl.query("select id from public.loyalty_transactions where customer_id = $1", [b.id]);
      const audit = await cl.query("select id from public.audit_logs");
      const qrs = await cl.query("select id from public.qr_sessions");
      return { profiles: profiles.rows, accounts: accounts.rows, visits: visits.rows, tx: tx.rows, audit: audit.rows, qrs: qrs.rows };
    });
    expect(seen.profiles.map((r) => r.id)).toEqual([a.id]);
    expect(seen.accounts.map((r) => r.customer_id)).toEqual([a.id]);
    expect(seen.visits).toHaveLength(0);
    expect(seen.tx).toHaveLength(0);
    expect(seen.audit).toHaveLength(0);
    expect(seen.qrs).toHaveLength(0);
    const search = await as("authenticated", a.id, (cl) => cl.query("select * from public.admin_search_customers('', 50, 0)"));
    expect(search.rows).toHaveLength(0);
    const lookup = await rpc("authenticated", a.id, "select public.lookup_redemption('PB-AAAAAA')");
    expect(lookup.code).toBe("FORBIDDEN");
  });

  it("anonymous visitors see only the active drink menu", async () => {
    const drinks = await as("anon", null, (cl) => cl.query("select id, is_active from public.drinks"));
    expect(drinks.rows.length).toBeGreaterThan(0);
    expect(drinks.rows.every((d) => d.is_active)).toBe(true);
    await expect(as("anon", null, (cl) => cl.query("select id from public.profiles"))).rejects.toThrow(/permission denied/);
  });

  it("20: staff cannot perform administrator actions", async () => {
    const c = await createUser();
    const checks = await Promise.all([
      rpc("authenticated", staff.id, "select public.admin_adjust_points($1, 3, 'staff trying')", [c.id]),
      rpc("authenticated", staff.id, "select public.admin_set_account_status($1, 'suspended', 'staff trying')", [c.id]),
      rpc("authenticated", staff.id, "select public.admin_set_role($1, 'admin')", [staff.id]),
      rpc("authenticated", staff.id, "select public.admin_update_settings('UTC', 60)"),
      rpc("authenticated", staff.id, "select public.revoke_qr_sessions(null, 'staff trying')"),
    ]);
    expect(checks.every((r) => r.code === "FORBIDDEN")).toBe(true);
    await expect(
      as("authenticated", staff.id, (cl) => cl.query("select * from public.admin_report('customers', null, null)")),
    ).rejects.toThrow(/Administrator access required/);
    const ins = await as("authenticated", staff.id, async (cl) => {
      try {
        await cl.query("insert into public.drinks (name) values ('Staff drink')");
        return "inserted";
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(ins).toMatch(/row-level security/);
    const audit = await as("authenticated", staff.id, (cl) => cl.query("select id from public.audit_logs"));
    expect(audit.rows).toHaveLength(0);
  });

  it("history tables are append-only", async () => {
    const c = await createUser();
    await scan(c.id, await issueQr(staff.id));
    await expect(pool.query("delete from public.loyalty_transactions where customer_id = $1", [c.id])).rejects.toThrow(/append-only/);
    await expect(pool.query("update public.audit_logs set action = 'x'")).rejects.toThrow(/append-only/);
    await expect(pool.query("update public.visits set note = 'x' where customer_id = $1", [c.id])).rejects.toThrow(/append-only/);
  });
});

describe("administrator tools", () => {
  it("manual adjustments require a reason, stay in range and are audited", async () => {
    const c = await createUser();
    const noReason = await rpc("authenticated", admin.id, "select public.admin_adjust_points($1, 2, 'no')", [c.id]);
    expect(noReason.code).toBe("REASON_REQUIRED");
    const negative = await rpc("authenticated", admin.id, "select public.admin_adjust_points($1, -1, 'Correct a mistake')", [c.id]);
    expect(negative.code).toBe("INVALID_ADJUSTMENT");
    const ok = await rpc("authenticated", admin.id, "select public.admin_adjust_points($1, 3, 'Missed scans during outage')", [c.id]);
    expect(ok.code).toBe("OK");
    expect((await account(c.id)).current_points).toBe(3);
    const { rows } = await pool.query(
      "select details from public.audit_logs where action = 'points.adjusted' and entity_id = $1",
      [c.id],
    );
    expect(rows[0].details).toMatchObject({ delta: 3, before: 0, after: 3 });
    const toFifteen = await rpc("authenticated", admin.id, "select public.admin_adjust_points($1, 12, 'Paper card migration')", [c.id]);
    expect(toFifteen.reward_unlocked).toBe(true);
    expect(await rewardFor(c.id)).toHaveLength(1);
  });

  it("21: reports reflect real database records", async () => {
    const c = await createUser({ name: "Report Person" });
    await scan(c.id, await issueQr(staff.id));
    await rpc("authenticated", admin.id, "select public.admin_adjust_points($1, 2, 'Report test adjustment')", [c.id]);

    const report = async (kind: string) =>
      as("authenticated", admin.id, (cl) => cl.query("select * from public.admin_report($1, null, null)", [kind]));

    const customers = (await report("customers")).rows.map((r) => r.admin_report);
    expect(customers.find((r) => r.customer_id === c.id)).toMatchObject({ full_name: "Report Person", current_points: 3, total_visits: 1 });

    const visits = (await report("visits")).rows.map((r) => r.admin_report);
    expect(visits.filter((r) => r.customer_id === c.id)).toHaveLength(1);

    const adjustments = (await report("adjustments")).rows.map((r) => r.admin_report);
    expect(adjustments.find((r) => r.customer_id === c.id)).toMatchObject({ points_delta: 2, reason: "Report test adjustment" });

    const balances = (await report("balances")).rows.map((r) => r.admin_report);
    expect(balances.find((r) => r.customer_id === c.id).current_points).toBe(3);

    const { rows: totals } = await pool.query("select count(*)::int n from public.visits");
    const daily = (await report("daily_visits")).rows.map((r) => r.admin_report);
    expect(daily.reduce((s, d) => s + Number(d.verified_visits), 0)).toBe(totals[0].n);

    const overview = await rpc("authenticated", admin.id, "select public.admin_overview()");
    expect(overview.total_visits).toBe(totals[0].n);
  });

  it("settings validate timezone and QR lifetime", async () => {
    expect((await rpc("authenticated", admin.id, "select public.admin_update_settings('Mars/Base', 60)")).code).toBe("INVALID_TIMEZONE");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_settings('Africa/Lagos', 5)")).code).toBe("INVALID_TTL");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_settings('Africa/Lagos', 60)")).code).toBe("OK");
  });
});

describe("22: business timezone boundaries", () => {
  it("computes the business-local date across midnight", async () => {
    const q = (ts: string, tz: string) =>
      pool.query("select public.business_date_for($1::timestamptz, $2)::text d", [ts, tz]).then((r) => r.rows[0].d);
    // 23:30 UTC is already the next day in Lagos (UTC+1).
    expect(await q("2026-10-19T23:30:00Z", "Africa/Lagos")).toBe("2026-10-20");
    expect(await q("2026-10-19T22:59:59Z", "Africa/Lagos")).toBe("2026-10-19");
    expect(await q("2026-10-19T23:00:00Z", "Africa/Lagos")).toBe("2026-10-20");
    // New York across a DST change.
    expect(await q("2026-11-01T03:59:00Z", "America/New_York")).toBe("2026-10-31");
    expect(await q("2026-11-01T04:00:00Z", "America/New_York")).toBe("2026-11-01");
  });

  it("stamps visits with the configured timezone's date", async () => {
    const c = await createUser();
    const res = await scan(c.id, await issueQr(staff.id));
    const { rows } = await pool.query(
      "select (now() at time zone (select business_timezone from public.app_settings))::date::text as d",
    );
    expect(res.visit_date).toBe(rows[0].d);
    const { rows: v } = await pool.query("select business_timezone from public.visits where customer_id = $1", [c.id]);
    expect(v[0].business_timezone).toBe("Africa/Lagos");
  });
});

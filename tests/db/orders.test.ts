import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createUser, pool, rpc } from "./helpers";

let staff: { id: string };
let admin: { id: string };
let frap: { id: string; price_naira: number };
let tee: { id: string; price_naira: number };

beforeAll(async () => {
  staff = await createUser({ role: "staff", name: "Order Staff" });
  admin = await createUser({ role: "admin", name: "Order Admin", phone: null });
  const { rows } = await pool.query("select id, name, price_naira from public.drinks where name in ('Palms Frappuccino', 'Palm Way Our Way Tee')");
  frap = rows.find((r) => r.name === "Palms Frappuccino");
  tee = rows.find((r) => r.name === "Palm Way Our Way Tee");
});

afterAll(async () => {
  await pool.end();
});

describe("menu", () => {
  it("has the full Palm Bite menu with prices, and only drinks can be rewards", async () => {
    const { rows } = await pool.query("select category, item_type, count(*)::int n, bool_or(is_reward_eligible) any_reward from public.drinks where is_active group by 1, 2");
    const by = Object.fromEntries(rows.map((r) => [r.category, r]));
    expect(by["Gems"].n).toBe(4);
    expect(by["Slab"].n).toBe(4);
    expect(by["Pastries"].n).toBe(8);
    expect(by["Merch"].n).toBe(4);
    expect(by["Our Picks"].n).toBe(3);
    expect(by["Slab"].any_reward).toBe(false);
    expect(by["Merch"].any_reward).toBe(false);
    expect(frap.price_naira).toBe(17000);
    const { rows: none } = await pool.query("select count(*)::int n from public.drinks where price_naira is null and is_active and name not like 'Test %'");
    expect(none[0].n).toBe(0);
  });

  it("food can never be made reward eligible", async () => {
    const { rows } = await pool.query("update public.drinks set is_reward_eligible = true where name = 'Pizza' returning is_reward_eligible");
    expect(rows[0].is_reward_eligible).toBe(false);
  });

  it("anyone can browse the menu, community and business details", async () => {
    const r = await as("anon", null, async (c) => ({
      menu: (await c.query("select id from public.drinks")).rows.length,
      community: (await c.query("select id from public.community_items")).rows.length,
      biz: (await c.query("select order_link, store_address from public.app_settings")).rows[0],
    }));
    expect(r.menu).toBeGreaterThan(25);
    expect(r.community).toBe(3);
    expect(r.biz.order_link).toBe("https://wa.me/message/DYZNLHGJWIAIC1");
    expect(r.biz.store_address).toBe("Palm View, along UBA Gate");
  });
});

describe("orders", () => {
  it("totals come from menu prices, not the phone", async () => {
    const c = await createUser();
    const res = await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', 'less ice')", [
      JSON.stringify([{ id: frap.id, qty: 2, price: 1 }, { id: tee.id, qty: 1 }]),
    ]);
    expect(res.code).toBe("ORDER_PLACED");
    expect(res.reference).toMatch(/^OR-[0-9A-Z]{5}$/);
    expect(res.total).toBe(2 * 17000 + 50000);
    const { rows } = await pool.query("select total_naira, status, note from public.orders where id = $1", [res.order_id]);
    expect(rows[0]).toMatchObject({ total_naira: 84000, status: "new", note: "less ice" });
  });

  it("rejects empty, invalid and unavailable items", async () => {
    const c = await createUser();
    expect((await rpc("authenticated", c.id, "select public.place_order('[]', 'pickup', null)")).code).toBe("EMPTY_ORDER");
    expect((await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', null)", [JSON.stringify([{ id: frap.id, qty: 0 }])])).code).toBe("INVALID_ORDER");
    expect((await rpc("authenticated", c.id, "select public.place_order($1, 'teleport', null)", [JSON.stringify([{ id: frap.id, qty: 1 }])])).code).toBe("INVALID_ORDER");
    await pool.query("update public.drinks set is_active = false where id = $1", [tee.id]);
    const r = await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', null)", [JSON.stringify([{ id: tee.id, qty: 1 }])]);
    await pool.query("update public.drinks set is_active = true where id = $1", [tee.id]);
    expect(r.code).toBe("ITEM_UNAVAILABLE");
  });

  it("signed-out visitors cannot order", async () => {
    await expect(rpc("anon", null, "select public.place_order($1, 'pickup', null)", [JSON.stringify([{ id: frap.id, qty: 1 }])])).rejects.toThrow(/permission denied/);
  });

  it("limits rapid repeat orders", async () => {
    const c = await createUser();
    const items = JSON.stringify([{ id: frap.id, qty: 1 }]);
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', null)", [items])).code);
    expect(codes.slice(0, 5).every((c) => c === "ORDER_PLACED")).toBe(true);
    expect(codes[5]).toBe("RATE_LIMITED");
  });

  it("customers see only their orders and can't cancel once sent; staff move them along", async () => {
    const a = await createUser();
    const b = await createUser();
    const res = await rpc("authenticated", a.id, "select public.place_order($1, 'dine_in', null)", [JSON.stringify([{ id: frap.id, qty: 1 }])]);
    const seenByB = await as("authenticated", b.id, (c) => c.query("select id from public.orders where id = $1", [res.order_id]));
    expect(seenByB.rows).toHaveLength(0);
    expect((await rpc("authenticated", b.id, "select public.set_order_status($1, 'cancelled')", [res.order_id])).code).toBe("ORDER_NOT_FOUND");
    expect((await rpc("authenticated", a.id, "select public.set_order_status($1, 'completed')", [res.order_id])).code).toBe("ORDER_LOCKED");
    expect((await rpc("authenticated", a.id, "select public.set_order_status($1, 'cancelled')", [res.order_id])).code).toBe("ORDER_LOCKED");
    expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, 'confirmed')", [res.order_id])).code).toBe("OK");
    expect((await rpc("authenticated", a.id, "select public.set_order_status($1, 'cancelled')", [res.order_id])).code).toBe("ORDER_LOCKED");
    expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, 'preparing')", [res.order_id])).code).toBe("OK");
    expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, 'on_the_way')", [res.order_id])).code).toBe("INVALID_ORDER");
    expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, 'ready')", [res.order_id])).code).toBe("OK");
    const seenByStaff = await as("authenticated", staff.id, (c) => c.query("select status from public.orders where id = $1", [res.order_id]));
    expect(seenByStaff.rows[0].status).toBe("ready");
  });
});

describe("orders: delivery, payment, go ahead", () => {
  it("delivery needs an address and a contact number", async () => {
    const c = await createUser();
    const items = JSON.stringify([{ id: frap.id, qty: 1 }]);
    expect((await rpc("authenticated", c.id, "select public.place_order($1, 'delivery', null, null, '08031234567')", [items])).code).toBe("ADDRESS_REQUIRED");
    expect((await rpc("authenticated", c.id, "select public.place_order($1, 'delivery', null, '12 Palm Street, Ado', null)", [items])).code).toBe("CONTACT_REQUIRED");
    expect((await rpc("authenticated", c.id, "select public.place_order($1, 'delivery', null, '12 Palm Street, Ado', 'call 12')", [items])).code).toBe("INVALID_CONTACT");
    const ok = await rpc("authenticated", c.id, "select public.place_order($1, 'delivery', null, '12 Palm Street, Ado', '0803 123 4567')", [items]);
    expect(ok.code).toBe("ORDER_PLACED");
    expect(ok.subtotal).toBe(frap.price_naira);
    expect(ok.delivery_fee).toBe(2000);
    expect(ok.total).toBe(frap.price_naira + 2000);
    const { rows } = await pool.query("select delivery_address, contact_phone, payment_status from public.orders where id = $1", [ok.order_id]);
    expect(rows[0]).toEqual({ delivery_address: "12 Palm Street, Ado", contact_phone: "08031234567", payment_status: "unpaid" });
    const fee = await pool.query("select total_naira, delivery_fee_naira from public.orders where id = $1", [ok.order_id]);
    expect(fee.rows[0]).toEqual({ total_naira: frap.price_naira + 2000, delivery_fee_naira: 2000 });
    // Delivery orders can go on their way and be delivered.
    for (const st of ["confirmed", "preparing", "on_the_way", "completed"]) {
      expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, $2)", [ok.order_id, st])).code).toBe("OK");
    }
    expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, 'preparing')", [ok.order_id])).code).toBe("ORDER_CLOSED");
  });

  it("pick up has no delivery fee; the fee is set by admins only", async () => {
    const c = await createUser();
    const o = await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', null, null, null)", [JSON.stringify([{ id: frap.id, qty: 2 }])]);
    expect(o.delivery_fee).toBe(0);
    expect(o.total).toBe(frap.price_naira * 2);
    expect((await rpc("authenticated", staff.id, "select public.admin_update_delivery_fee(500)")).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_delivery_fee(-1)")).code).toBe("INVALID_INPUT");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_delivery_fee(2500)")).code).toBe("OK");
    const d = await rpc("authenticated", c.id, "select public.place_order($1, 'delivery', null, '3 Market Road', '08031234567')", [JSON.stringify([{ id: frap.id, qty: 1 }])]);
    expect(d.delivery_fee).toBe(2500);
    expect((await rpc("authenticated", admin.id, "select public.admin_update_delivery_fee(2000)")).code).toBe("OK");
  });

  it("records the team member who accepted the order", async () => {
    const c = await createUser();
    const o = await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', null, null, null)", [JSON.stringify([{ id: frap.id, qty: 1 }])]);
    await rpc("authenticated", staff.id, "select public.set_order_status($1, 'confirmed')", [o.order_id]);
    await rpc("authenticated", admin.id, "select public.set_order_status($1, 'preparing')", [o.order_id]);
    const { rows } = await pool.query(
      "select o.accepted_by, o.accepted_by_name = p.full_name as named, o.accepted_at is not null as at from public.orders o join public.profiles p on p.id = o.accepted_by where o.id = $1",
      [o.order_id],
    );
    expect(rows[0]).toEqual({ accepted_by: staff.id, named: true, at: true });
  });

  it("receipts go in the customer's own folder; staff confirm payment", async () => {
    const a = await createUser();
    const b = await createUser();
    const o = await rpc("authenticated", a.id, "select public.place_order($1, 'pickup', null, null, null)", [JSON.stringify([{ id: frap.id, qty: 1 }])]);
    expect((await rpc("authenticated", a.id, "select public.submit_order_receipt($1, $2)", [o.order_id, `${b.id}/r.jpg`])).code).toBe("INVALID_INPUT");
    expect((await rpc("authenticated", a.id, "select public.submit_order_receipt($1, $2)", [o.order_id, `${a.id}/../x.jpg`])).code).toBe("INVALID_INPUT");
    expect((await rpc("authenticated", b.id, "select public.submit_order_receipt($1, $2)", [o.order_id, `${b.id}/r.jpg`])).code).toBe("ORDER_NOT_FOUND");
    expect((await rpc("authenticated", a.id, "select public.submit_order_receipt($1, $2)", [o.order_id, `${a.id}/r-1.jpg`])).code).toBe("OK");
    let { rows } = await pool.query("select payment_status, receipt_path from public.orders where id = $1", [o.order_id]);
    expect(rows[0]).toEqual({ payment_status: "receipt_sent", receipt_path: `${a.id}/r-1.jpg` });
    expect((await rpc("authenticated", a.id, "select public.set_order_payment($1, true)", [o.order_id])).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", staff.id, "select public.set_order_payment($1, true)", [o.order_id])).code).toBe("OK");
    ({ rows } = await pool.query("select payment_status, paid_at is not null as paid from public.orders where id = $1", [o.order_id]));
    expect(rows[0]).toEqual({ payment_status: "paid", paid: true });
    expect((await rpc("authenticated", a.id, "select public.submit_order_receipt($1, $2)", [o.order_id, `${a.id}/r-2.jpg`])).code).toBe("ORDER_CLOSED");
  });

  it("go ahead is for the order's owner, and not too often", async () => {
    const a = await createUser();
    const b = await createUser();
    const o = await rpc("authenticated", a.id, "select public.place_order($1, 'pickup', null, null, null)", [JSON.stringify([{ id: frap.id, qty: 1 }])]);
    expect((await rpc("authenticated", b.id, "select public.order_go_ahead($1)", [o.order_id])).code).toBe("ORDER_NOT_FOUND");
    expect((await rpc("authenticated", a.id, "select public.order_go_ahead($1)", [o.order_id])).code).toBe("OK");
    expect((await rpc("authenticated", a.id, "select public.order_go_ahead($1)", [o.order_id])).code).toBe("RATE_LIMITED");
  });

  it("push subscriptions are private and limited per person", async () => {
    const a = await createUser();
    for (let i = 0; i < 7; i++) {
      expect((await rpc("authenticated", a.id, "select public.save_push_subscription($1, $2, $3)", [`https://push.example/${a.id}/${i}`, "p".repeat(40), "a".repeat(16)])).code).toBe("OK");
    }
    const { rows } = await pool.query("select count(*)::int n from public.push_subscriptions where user_id = $1", [a.id]);
    expect(rows[0].n).toBe(5);
    expect((await rpc("authenticated", a.id, "select public.save_push_subscription($1, $2, $3)", ["http://insecure", "p".repeat(40), "a".repeat(16)])).code).toBe("INVALID_INPUT");
    await expect(as("authenticated", a.id, (c) => c.query("select * from public.push_subscriptions"))).rejects.toThrow();
  });

  it("only admins change the bank details", async () => {
    expect((await rpc("authenticated", staff.id, "select public.admin_update_bank('X Bank', 'PalmBite', '1234567890')")).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_bank('Providus Bank', 'PalmBite', '12345')")).code).toBe("INVALID_INPUT");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_bank('Providus Bank', 'PalmBite', '1311 482 257')")).code).toBe("OK");
    const biz = await as("anon", null, async (c) => (await c.query("select bank_name, bank_account_name, bank_account_number from public.app_settings")).rows[0]);
    expect(biz).toEqual({ bank_name: "Providus Bank", bank_account_name: "PalmBite", bank_account_number: "1311482257" });
  });
});

describe("orders v3: in charge, packaging, ready time, reasons, staff orders", () => {
  const items = () => JSON.stringify([{ id: frap.id, qty: 1 }]);
  const set = (who: string, id: unknown, st: string, reason: string | null = null, eta: number | null = null) =>
    rpc("authenticated", who, "select public.staff_set_order_status($1, $2, $3, $4)", [id, st, reason, eta]);

  it("the staff member who confirms is in charge; others can't move it, admins can", async () => {
    const other = await createUser({ role: "staff" });
    const c = await createUser();
    const o = await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', null, null, null)", [items()]);
    expect((await set(staff.id, o.order_id, "confirmed", null, 3)).code).toBe("INVALID_ETA");
    expect((await set(staff.id, o.order_id, "confirmed", null, 20)).code).toBe("OK");
    const { rows } = await pool.query("select accepted_by, eta_minutes, eta_at > now() + interval '19 minutes' as eta_ok from public.orders where id = $1", [o.order_id]);
    expect(rows[0]).toEqual({ accepted_by: staff.id, eta_minutes: 20, eta_ok: true });
    const blocked = await set(other.id, o.order_id, "preparing");
    expect(blocked.code).toBe("NOT_IN_CHARGE");
    expect(blocked.in_charge).toBeTruthy();
    expect((await rpc("authenticated", other.id, "select public.set_order_eta($1, 10)", [o.order_id])).code).toBe("NOT_IN_CHARGE");
    for (const st of ["preparing", "packaging", "ready"]) expect((await set(staff.id, o.order_id, st)).code).toBe("OK");
    expect((await set(admin.id, o.order_id, "completed")).code).toBe("OK");
  });

  it("cancelling needs a reason, which the customer can see", async () => {
    const c = await createUser();
    const o = await rpc("authenticated", c.id, "select public.place_order($1, 'pickup', null, null, null)", [items()]);
    expect((await set(staff.id, o.order_id, "cancelled")).code).toBe("REASON_REQUIRED");
    expect((await set(staff.id, o.order_id, "cancelled", "Not available")).code).toBe("OK");
    const seen = await as("authenticated", c.id, (cl) => cl.query("select status, cancel_reason, accepted_by from public.orders where id = $1", [o.order_id]));
    expect(seen.rows[0]).toEqual({ status: "cancelled", cancel_reason: "Not available", accepted_by: null });
  });

  it("staff place orders for customers and walk ins; they start confirmed and in charge", async () => {
    const c = await createUser();
    const forC = await rpc("authenticated", staff.id, "select public.staff_place_order($1, null, $2, 'pickup', null, null, null, true, 15)", [c.id, items()]);
    expect(forC.code).toBe("ORDER_PLACED");
    const { rows } = await pool.query("select customer_id, status, accepted_by, placed_by, payment_status, eta_minutes from public.orders where id = $1", [forC.order_id]);
    expect(rows[0]).toEqual({ customer_id: c.id, status: "confirmed", accepted_by: staff.id, placed_by: staff.id, payment_status: "paid", eta_minutes: 15 });
    const seen = await as("authenticated", c.id, (cl) => cl.query("select id from public.orders where id = $1", [forC.order_id]));
    expect(seen.rows).toHaveLength(1);

    const walk = await rpc("authenticated", staff.id, "select public.staff_place_order(null, 'Ada at table 3', $1, 'dine_in', null, null, null, false, null)", [items()]);
    expect(walk.code).toBe("ORDER_PLACED");
    expect((await rpc("authenticated", staff.id, "select public.staff_place_order(null, null, $1, 'pickup', null, null, null, false, null)", [items()])).code).toBe("CUSTOMER_REQUIRED");
    expect((await rpc("authenticated", c.id, "select public.staff_place_order(null, 'Me', $1, 'pickup', null, null, null, true, null)", [items()])).code).toBe("FORBIDDEN");
    const del = await rpc("authenticated", staff.id, "select public.staff_place_order(null, 'Tunde', $1, 'delivery', null, '5 Market Road', '08030000000', false, 30)", [items()]);
    expect(del.code).toBe("ORDER_PLACED");
    expect(del.delivery_fee).toBe(2000);
  });
});

describe("only Palm Bite email sign-ins get staff powers", () => {
  it("an admin signed in through an outside provider is treated as a customer", async () => {
    const asOutside = async (provider: string) => {
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: admin.id, role: "authenticated", app_metadata: { provider }, amr: [{ method: provider === "email" ? "password" : "oauth" }] }),
        ]);
        await c.query("set local role authenticated");
        const { rows } = await c.query("select public.is_admin() as admin, public.is_staff() as staff");
        await c.query("rollback");
        return rows[0];
      } finally {
        c.release();
      }
    };
    expect(await asOutside("email")).toEqual({ admin: true, staff: true });
    expect(await asOutside("google")).toEqual({ admin: false, staff: false });
    expect(await asOutside("apple")).toEqual({ admin: false, staff: false });
  });
});

describe("community and business settings", () => {
  it("only admins can edit community items and business details", async () => {
    const c = await createUser();
    const tryInsert = (uid: string) =>
      as("authenticated", uid, async (cl) => {
        try {
          await cl.query("insert into public.community_items (kind, title) values ('club', 'Run Club')");
          return "ok";
        } catch (e) {
          return (e as Error).message;
        }
      });
    expect(await tryInsert(c.id)).toMatch(/row-level security/);
    expect(await tryInsert(staff.id)).toMatch(/row-level security/);
    expect(await tryInsert(admin.id)).toBe("ok");
    expect((await rpc("authenticated", staff.id, "select public.admin_update_business('https://wa.me/x', null, 'X', null)")).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_business('http://insecure', null, 'X', null)")).code).toBe("INVALID_LINK");
    expect((await rpc("authenticated", admin.id, "select public.admin_update_business('https://wa.me/message/DYZNLHGJWIAIC1', '+234 803 123 4567', 'Palm View, along UBA Gate', 'Pay by transfer')")).code).toBe("OK");
    const { rows } = await pool.query("select whatsapp_number, payment_note from public.app_settings");
    expect(rows[0]).toMatchObject({ whatsapp_number: "2348031234567", payment_note: "Pay by transfer" });
    await pool.query("update public.app_settings set whatsapp_number = null, payment_note = null");
  });
});

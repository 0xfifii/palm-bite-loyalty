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
    expect(by["Pastries"].n).toBe(6);
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

  it("customers see only their orders and can only cancel new ones; staff move them along", async () => {
    const a = await createUser();
    const b = await createUser();
    const res = await rpc("authenticated", a.id, "select public.place_order($1, 'dine_in', null)", [JSON.stringify([{ id: frap.id, qty: 1 }])]);
    const seenByB = await as("authenticated", b.id, (c) => c.query("select id from public.orders where id = $1", [res.order_id]));
    expect(seenByB.rows).toHaveLength(0);
    expect((await rpc("authenticated", b.id, "select public.set_order_status($1, 'cancelled')", [res.order_id])).code).toBe("ORDER_NOT_FOUND");
    expect((await rpc("authenticated", a.id, "select public.set_order_status($1, 'completed')", [res.order_id])).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, 'confirmed')", [res.order_id])).code).toBe("OK");
    expect((await rpc("authenticated", a.id, "select public.set_order_status($1, 'cancelled')", [res.order_id])).code).toBe("FORBIDDEN");
    expect((await rpc("authenticated", staff.id, "select public.set_order_status($1, 'ready')", [res.order_id])).code).toBe("OK");
    const seenByStaff = await as("authenticated", staff.id, (c) => c.query("select status from public.orders where id = $1", [res.order_id]));
    expect(seenByStaff.rows[0].status).toBe("ready");
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

"use client";

/**
 * The order basket, kept in this browser only (localStorage). It holds item
 * ids and quantities; names and prices always come from the menu, and the
 * final total is calculated by the database when the order is placed.
 */
export type CartLine = { id: string; qty: number };

const KEY = "pb-cart-v1";
const EMPTY: CartLine[] = [];
let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.id === "string" && Number.isInteger(l.qty) && l.qty > 0 && l.qty <= 50).slice(0, 40)
      : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // storage unavailable: the basket still works for this visit
  }
  listeners.forEach((l) => l());
}

export function subscribeCart(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const cartSnapshot = () => read();
export const cartServerSnapshot = () => EMPTY;

export function setQty(id: string, qty: number) {
  const lines = read().filter((l) => l.id !== id);
  const q = Math.max(0, Math.min(50, Math.trunc(qty)));
  write(q > 0 ? [...lines, { id, qty: q }].slice(0, 40) : lines);
}

export function addOne(id: string) {
  const current = read().find((l) => l.id === id)?.qty ?? 0;
  setQty(id, current + 1);
}

export function clearCart() {
  write([]);
}

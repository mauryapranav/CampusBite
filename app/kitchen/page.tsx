"use client";

import { useCallback, useEffect, useState } from "react";

type KitchenOrder = {
  id: number;
  status: "placed" | "preparing" | "ready";
  total: number;
  student_name: string | null;
  pickup_time: string | null;
  item_names: string[];
};

const columns: {
  status: KitchenOrder["status"];
  title: string;
  action: string;
  nextStatus: "preparing" | "ready" | "collected";
}[] = [
  { status: "placed", title: "New orders", action: "Start preparing", nextStatus: "preparing" },
  { status: "preparing", title: "Preparing", action: "Mark ready", nextStatus: "ready" },
  { status: "ready", title: "Ready for pickup", action: "Collected", nextStatus: "collected" },
];

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/kitchen");
      const data = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "Could not load kitchen orders.");
      setAuthenticated(true);
      setOrders(data.orders as KitchenOrder[]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load kitchen orders.");
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const intervalId = window.setInterval(() => void loadOrders(), 3000);
    return () => window.clearInterval(intervalId);
  }, [loadOrders]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/kitchen/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Kitchen login failed.");
      setPasscode("");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kitchen login failed.");
    }
  }

  async function updateStatus(orderId: number, status: "preparing" | "ready" | "collected") {
    setUpdating(orderId);
    setError("");
    try {
      const response = await fetch("/api/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update order.");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">CampusBite · SRM</p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">Kitchen orders</h1>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-3 py-1.5 text-sm font-medium text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live
        </span>
      </header>

      {error && <p className="mb-4 rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-200">{error}</p>}

      {authenticated === false ? (
        <form onSubmit={login} className="mx-auto mt-16 max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Kitchen staff sign in</h2>
          <p className="mt-1 text-sm text-slate-400">Enter the kitchen passcode to view and manage orders.</p>
          <input
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete="current-password"
            className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
            placeholder="Kitchen passcode"
            required
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Sign in
          </button>
        </form>
      ) : authenticated === null ? (
        <p className="text-sm text-slate-400">Checking kitchen access...</p>
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="min-h-[65vh] rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">{column.title}</h2>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                  {columnOrders.length}
                </span>
              </div>
              <ul className="space-y-3">
                {columnOrders.map((order) => (
                  <li key={order.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">Order #{order.id}</h3>
                        <p className="mt-1 text-sm text-slate-300">{order.student_name ?? "Student"}</p>
                      </div>
                      {order.pickup_time && (
                        <span className="rounded-md bg-slate-700 px-2 py-1 text-sm font-medium text-emerald-300">
                          {order.pickup_time}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-slate-200">{order.item_names.join(", ") || "Items unavailable"}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
                      <span className="text-sm font-semibold">Rs {order.total}</span>
                      <button
                        type="button"
                        disabled={updating === order.id}
                        onClick={() => updateStatus(order.id, column.nextStatus)}
                        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updating === order.id ? "Updating..." : column.action}
                      </button>
                    </div>
                  </li>
                ))}
                {columnOrders.length === 0 && (
                  <li className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-sm text-slate-500">
                    No orders
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
      )}
    </main>
  );
}

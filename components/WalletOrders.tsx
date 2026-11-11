"use client";

import { useEffect, useState } from "react";

type Order = {
  id: number;
  status: string;
  total: number;
  pickup_time: string | null;
  item_names: string[];
};

type MeData = {
  wallet: { name: string; balance: number };
  orders: Order[];
};

const statusStyles: Record<string, string> = {
  placed: "bg-sky-100 text-sky-800",
  preparing: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  collected: "bg-slate-200 text-slate-700",
  cancelled: "bg-rose-100 text-rose-800",
};

export default function WalletOrders({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<MeData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/me");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load wallet and orders.");
        if (active) {
          setData(result as MeData);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load wallet and orders.");
      }
    }

    void load();
    const intervalId = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  return (
    <section className="rounded-xl bg-slate-900 p-4 text-white shadow-sm">
      {error && <p className="mb-3 rounded-lg bg-rose-950 px-3 py-2 text-sm text-rose-200">{error}</p>}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">CampusBite wallet</p>
          <h2 className="mt-1 text-2xl font-semibold">
            {data ? `Rs ${data.wallet.balance}` : "Loading..."}
          </h2>
        </div>
        <p className="text-right text-sm text-slate-300">{data?.wallet.name ?? ""}</p>
      </div>

      <div className="mt-5 border-t border-slate-700 pt-4">
        <h3 className="mb-3 font-semibold">My orders today</h3>
        {!error && data?.orders.length === 0 && (
          <p className="text-sm text-slate-300">No orders yet today.</p>
        )}
        <ul className="space-y-3">
          {data?.orders.map((order) => (
            <li key={order.id} className="rounded-lg bg-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Order #{order.id}
                  {order.pickup_time && <span className="ml-2 font-normal text-slate-300">· {order.pickup_time}</span>}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusStyles[order.status] ?? "bg-slate-200 text-slate-700"
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{order.item_names.join(", ") || "Items unavailable"}</p>
              <p className="mt-1 text-right text-sm font-medium">Rs {order.total}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

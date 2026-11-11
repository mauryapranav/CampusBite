"use client";

import { useEffect, useState } from "react";

type MenuItem = {
  id: number;
  name: string;
  category: "meal" | "snack" | "drink" | "sweet";
  price: number;
  is_veg: boolean;
  stock: number;
  description: string;
};

const categories: { key: MenuItem["category"]; label: string }[] = [
  { key: "meal", label: "Meals" },
  { key: "snack", label: "Snacks" },
  { key: "sweet", label: "Sweets" },
  { key: "drink", label: "Drinks" },
];

export default function MenuPanel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/menu");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load the menu.");
        if (active) {
          setItems(result.items as MenuItem[]);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load the menu.");
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
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">Today&apos;s menu</h2>
        <p className="text-xs text-slate-500">Availability updates automatically.</p>
      </div>
      {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
      <div className="space-y-4 p-4">
        {categories.map(({ key, label }) => {
          const categoryItems = items.filter((item) => item.category === key);
          if (!categoryItems.length) return null;
          return (
            <section key={key} aria-label={label}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>
              <ul className="divide-y divide-slate-100">
                {categoryItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        aria-label={item.is_veg ? "Vegetarian" : "Non-vegetarian"}
                        title={item.is_veg ? "Vegetarian" : "Non-vegetarian"}
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          item.is_veg ? "bg-emerald-600" : "bg-red-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {item.stock === 0 ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Sold out</span>
                      ) : item.stock <= 3 ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Only {item.stock} left
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">{item.stock} available</span>
                      )}
                      <span className="text-sm font-semibold">Rs {item.price}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {!error && items.length === 0 && <p className="text-sm text-slate-500">Loading menu...</p>}
      </div>
    </section>
  );
}

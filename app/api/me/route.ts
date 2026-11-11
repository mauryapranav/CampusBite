import { NextResponse } from "next/server";
import { CURRENT_STUDENT_ID, formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  const [{ data: wallet, error: walletError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase
      .from("wallets")
      .select("name, balance")
      .eq("student_id", CURRENT_STUDENT_ID)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, status, total, created_at, pickup_slots(slot_time), order_items(menu_items(name))")
      .eq("student_id", CURRENT_STUDENT_ID)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (walletError) {
    console.error("[GET /api/me wallet]", walletError.message);
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }
  if (ordersError) {
    console.error("[GET /api/me orders]", ordersError.message);
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }
  if (!wallet) {
    console.error(`[GET /api/me] Wallet not found for ${CURRENT_STUDENT_ID}`);
    return NextResponse.json({ error: "Wallet not found for the current student." }, { status: 404 });
  }

  return NextResponse.json({
    wallet,
    orders: orders.map((order) => {
      const pickupSlot = firstRelated<{ slot_time: string }>(order.pickup_slots);
      return {
        id: order.id,
        status: order.status,
        total: order.total,
        pickup_time: pickupSlot ? formatSlot(pickupSlot.slot_time) : null,
        item_names: order.order_items
          .map((item) => firstRelated<{ name: string }>(item.menu_items)?.name)
          .filter((name): name is string => Boolean(name)),
      };
    }),
  });
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

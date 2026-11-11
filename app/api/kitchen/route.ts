import { NextResponse } from "next/server";
import { z } from "zod";
import { formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateOrderSchema = z.object({
  order_id: z.number().int().positive(),
  status: z.enum(["preparing", "ready", "collected"]),
});

const nextStatus: Record<string, string> = {
  placed: "preparing",
  preparing: "ready",
  ready: "collected",
};

export async function GET() {
  const { data, error } = await getSupabase()
    .from("orders")
    .select("id, status, total, created_at, pickup_slots(slot_time), wallets(name), order_items(menu_items(name))")
    .in("status", ["placed", "preparing", "ready"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/kitchen]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    orders: data.map((order) => {
      const pickupSlot = firstRelated<{ slot_time: string }>(order.pickup_slots);
      const wallet = firstRelated<{ name: string }>(order.wallets);
      return {
        id: order.id,
        status: order.status,
        total: order.total,
        student_name: wallet?.name ?? null,
        pickup_time: pickupSlot ? formatSlot(pickupSlot.slot_time) : null,
        item_names: order.order_items
          .map((item) => firstRelated<{ name: string }>(item.menu_items)?.name)
          .filter((name): name is string => Boolean(name)),
      };
    }),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order status update", details: parsed.error.issues }, { status: 400 });
  }

  const { order_id, status } = parsed.data;
  const supabase = getSupabase();
  const { data: current, error: findError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", order_id)
    .maybeSingle();

  if (findError) {
    console.error("[POST /api/kitchen lookup]", findError.message);
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: `Order ${order_id} not found.` }, { status: 404 });
  }
  if (nextStatus[current.status] !== status) {
    return NextResponse.json(
      { error: `Cannot change order status from ${current.status} to ${status}.` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", order_id)
    .eq("status", current.status)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("[POST /api/kitchen update]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Order status changed before this update could be applied." }, { status: 409 });
  }
  return NextResponse.json({ order: data });
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

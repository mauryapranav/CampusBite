import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import { CURRENT_STUDENT_ID, formatSlot } from "../campusbite";

const getMenu = defineTool({
  name: "getMenu",
  description: "Use this when the user asks what food is available or wants menu recommendations.",
  schema: z.object({
    category: z
      .enum(["meal", "snack", "drink", "sweet"])
      .optional()
      .describe("Optional menu category to filter by."),
    veg_only: z.boolean().optional().describe("If true, return only vegetarian items."),
    max_price: z.number().int().optional().describe("Optional maximum price in whole rupees."),
  }),
  run: async ({ category, veg_only, max_price }) => {
    let query = getSupabase()
      .from("menu_items")
      .select("id, name, category, price, is_veg, stock, description")
      .gt("stock", 0)
      .order("category")
      .order("price");
    if (category) query = query.eq("category", category);
    if (veg_only) query = query.eq("is_veg", true);
    if (max_price !== undefined) query = query.lte("price", max_price);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { items: data };
  },
});

const getWalletBalance = defineTool({
  name: "getWalletBalance",
  description: "Use this when the user asks about their wallet balance or whether they can afford an order.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("wallets")
      .select("name, balance")
      .eq("student_id", CURRENT_STUDENT_ID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Wallet not found for the current student.");
    return { name: data.name, balance: data.balance };
  },
});

const getPickupSlots = defineTool({
  name: "getPickupSlots",
  description: "Use this when the user asks for available pickup times.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("pickup_slots")
      .select("id, slot_time, capacity, booked")
      .order("slot_time");
    if (error) throw new Error(error.message);
    return {
      slots: data
        .map((slot) => ({
          slot_id: slot.id,
          time: formatSlot(slot.slot_time),
          free: slot.capacity - slot.booked,
        }))
        .filter((slot) => slot.free > 0),
    };
  },
});

const getMyOrders = defineTool({
  name: "getMyOrders",
  description: "Use this when the user asks to see their recent orders or check an order's status.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("orders")
      .select("id, status, total, pickup_slots(slot_time), order_items(menu_items(name))")
      .eq("student_id", CURRENT_STUDENT_ID)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return {
      orders: data.map((order) => {
        const pickupSlot = firstRelated<{ slot_time: string }>(order.pickup_slots);
        const itemNames = order.order_items
          .map((item) => firstRelated<{ name: string }>(item.menu_items)?.name)
          .filter((name): name is string => Boolean(name));
        return {
          id: order.id,
          status: order.status,
          total: order.total,
          pickup_time: pickupSlot ? formatSlot(pickupSlot.slot_time) : null,
          item_names: itemNames,
        };
      }),
    };
  },
});

const placeOrder = defineTool({
  name: "placeOrder",
  description: "Use this when the user confirms an order and selects a pickup slot.",
  writes: true,
  schema: z.object({
    items: z
      .array(
        z.object({
          menu_item_id: z.number().int().positive(),
          quantity: z.number().int().min(1).max(5),
        })
      )
      .min(1),
    slot_id: z.number().int().positive(),
  }),
  run: async ({ items, slot_id }) => {
    const { data, error } = await getSupabase().rpc("place_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_slot_id: slot_id,
      p_items: items,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

const cancelOrder = defineTool({
  name: "cancelOrder",
  description: "Use this when the user asks to cancel one of their orders.",
  writes: true,
  schema: z.object({
    order_id: z.number().int().positive(),
  }),
  run: async ({ order_id }) => {
    const { data, error } = await getSupabase().rpc("cancel_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_order_id: order_id,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

export const tools: AgentTool[] = [
  getMenu,
  getWalletBalance,
  getPickupSlots,
  getMyOrders,
  placeOrder,
  cancelOrder,
];

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

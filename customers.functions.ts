import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireVerifiedUser } from "@/integrations/supabase/verified-user-middleware";
import { friendlyDbError } from "./order-rules";
import type { Database } from "@/integrations/supabase/types";

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireVerifiedUser])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("customers").select("*").eq("owner_id", context.userId).order("last_order_at", { ascending: false, nullsFirst: false }).limit(1000);
    if (error) throw new Error("Could not load your customers.");
    return data;
  });

export const getCustomerOrders = createServerFn({ method: "GET" })
  .middleware([requireVerifiedUser])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: orders, error } = await context.supabase.from("orders").select("id, order_number, total, status, created_at, order_items(title, quantity)").eq("owner_id", context.userId).eq("customer_id", data.id).order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Could not load this customer's orders.");
    return orders;
  });

const tag = z.string().trim().min(1).max(30);
export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireVerifiedUser])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(15).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    notes: z.string().trim().max(2000).optional(),
    tags: z.array(tag).max(20).optional(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    const patch: Database["public"]["Tables"]["customers"]["Update"] = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.email !== undefined) patch.email = data.email || null;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.tags !== undefined) patch.tags = [...new Set(data.tags.map(t => t.toLowerCase()))];

    const { error } = await context.supabase.from("customers").update(patch).eq("id", data.id).eq("owner_id", context.userId).select("id").single();
    if (error) throw new Error("Could not save this customer.");
    return { ok: true };
  });

export const eraseCustomer = createServerFn({ method: "POST" })
  .middleware([requireVerifiedUser])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("erase_customer", { _customer_id: data.id });
    if (error) throw new Error(friendlyDbError(error.message));
    return { ok: true };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireVerifiedUser])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await context.supabase.from("orders").update({ customer_id: null }).eq("customer_id", data.id).eq("owner_id", context.userId);
    const { error } = await context.supabase.from("customers").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error("Could not delete this customer.");
    return { ok: true };
  });

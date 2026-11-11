import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPasscode, KITCHEN_SESSION_COOKIE } from "@/lib/auth";

const kitchenLoginSchema = z.object({ passcode: z.string().min(1).max(100) });

export async function POST(request: Request) {
  const expected = process.env.KITCHEN_PASSCODE?.trim();
  if (!expected) {
    return NextResponse.json({ error: "KITCHEN_PASSCODE is not set on the server." }, { status: 500 });
  }

  const parsed = kitchenLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.passcode.trim() !== expected) {
    return NextResponse.json({ error: "Wrong kitchen passcode." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(KITCHEN_SESSION_COOKIE, await hashPasscode(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

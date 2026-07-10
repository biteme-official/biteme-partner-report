import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { brandAllListSQL } from "@/lib/queries/brands";
import type { BrandBasic } from "@/lib/types";

export async function GET() {
  try {
    const brands = await query<BrandBasic>(brandAllListSQL());
    return NextResponse.json({ brands });
  } catch (e) {
    console.error("Brand all-list error:", e);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

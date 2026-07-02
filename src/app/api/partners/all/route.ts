import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { partnerAllListSQL } from "@/lib/queries/partners";
import type { PartnerBasic } from "@/lib/types";

export async function GET() {
  try {
    const partners = await query<PartnerBasic>(partnerAllListSQL());
    return NextResponse.json({ partners });
  } catch (e) {
    console.error("Partner all-list error:", e);
    return NextResponse.json(
      { error: "Failed to fetch partners" },
      { status: 500 }
    );
  }
}

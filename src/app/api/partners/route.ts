import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { partnerListSQL } from "@/lib/queries/partners";
import type { PartnerSummary } from "@/lib/types";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const days = Number(params.get("days") || 30);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  try {
    const partners = await query<PartnerSummary>(partnerListSQL(start, end));
    return NextResponse.json({ partners, period: { start, end, days } });
  } catch (e) {
    console.error("Partner list error:", e);
    return NextResponse.json(
      { error: "Failed to fetch partners" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  partnerMonthlySalesSQL,
  partnerWeeklySalesSQL,
  partnerTopGrowthProductsSQL,
  partnerReturnRateSQL,
  partnerBuyerTypeSQL,
  partnerBuyerMonthlySQL,
} from "@/lib/queries/insights";
import type { MonthlySales, WeeklySales, GrowthProduct, ReturnRate, BuyerTypeSummary, BuyerMonthly } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;

  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  let start: Date, end: Date;
  if (startParam && endParam) {
    start = new Date(startParam + "T00:00:00");
    end = new Date(endParam + "T23:59:59");
  } else {
    end = new Date();
    start = new Date();
    start.setDate(start.getDate() - 180);
  }

  try {
    const [monthly, weekly, growth, returnRate, buyerType, buyerMonthly] = await Promise.all([
      query<MonthlySales>(partnerMonthlySalesSQL(id, start, end)),
      query<WeeklySales>(partnerWeeklySalesSQL(id, 12)),
      query<GrowthProduct>(partnerTopGrowthProductsSQL(id)),
      query<ReturnRate>(partnerReturnRateSQL(id, start, end)),
      query<BuyerTypeSummary>(partnerBuyerTypeSQL(id, start, end)),
      query<BuyerMonthly>(partnerBuyerMonthlySQL(id, start, end)),
    ]);

    return NextResponse.json({
      monthly, weekly, growth,
      returnRate: returnRate[0] ?? null,
      buyerType,
      buyerMonthly,
    });
  } catch (e) {
    console.error("Partner insights error:", e);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

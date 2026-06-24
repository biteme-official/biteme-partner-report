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

  // 신규/재구매 분석은 기간 필터와 무관하게 항상 최근 180일 고정
  const buyerEnd = new Date();
  const buyerStart = new Date();
  buyerStart.setDate(buyerStart.getDate() - 180);

  try {
    const [monthly, weekly, growth, returnRate, buyerType, buyerMonthly] = await Promise.all([
      query<MonthlySales>(partnerMonthlySalesSQL(id, 12)),
      query<WeeklySales>(partnerWeeklySalesSQL(id, 12)),
      query<GrowthProduct>(partnerTopGrowthProductsSQL(id)),
      query<ReturnRate>(partnerReturnRateSQL(id, start, end)),
      query<BuyerTypeSummary>(partnerBuyerTypeSQL(id, buyerStart, buyerEnd)),
      query<BuyerMonthly>(partnerBuyerMonthlySQL(id, buyerStart, buyerEnd)),
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

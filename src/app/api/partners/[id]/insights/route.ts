import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import {
  partnerMonthlySalesSQL,
  partnerWeeklySalesSQL,
  partnerTopGrowthProductsSQL,
  partnerReturnRateSQL,
  partnerBuyerTypeSQL,
  partnerBuyerTypeByBrandSQL,
  partnerBuyerMonthlySQL,
} from "@/lib/queries/insights";
import type {
  MonthlySales,
  WeeklySales,
  GrowthProduct,
  ReturnRate,
  BuyerTypeSummary,
  BuyerTypeByBrand,
  BuyerMonthly,
} from "@/lib/types";
import { toDateStr } from "@/lib/date";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 180);

  try {
    const [monthly, weekly, growth, returnRate, buyerType, buyerMonthly, buyerTypeByBrand] = await queryBatch<
      [MonthlySales[], WeeklySales[], GrowthProduct[], ReturnRate[], BuyerTypeSummary[], BuyerMonthly[], BuyerTypeByBrand[]]
    >([
      partnerMonthlySalesSQL(id, 6),
      partnerWeeklySalesSQL(id, 12),
      partnerTopGrowthProductsSQL(id),
      partnerReturnRateSQL(id, start, end),
      partnerBuyerTypeSQL(id, start, end),
      partnerBuyerMonthlySQL(id, 6),
      partnerBuyerTypeByBrandSQL(id, start, end),
    ]);

    return NextResponse.json({
      monthly, weekly, growth,
      returnRate: returnRate[0] ?? null,
      buyerType,
      buyerTypePeriod: { start: toDateStr(start), end: toDateStr(end) },
      buyerMonthly,
      // 브랜드별 신규/재구매 — buyerType 과 같은 180일 창·같은 첫 주문 기준
      buyerTypeByBrand,
    });
  } catch (e) {
    console.error("Partner insights error:", e);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

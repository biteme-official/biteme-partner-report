import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import {
  brandMonthlySalesSQL,
  brandTopGrowthProductsSQL,
  brandReturnRateSQL,
  brandBuyerTypeSQL,
  brandBuyerMonthlySQL,
} from "@/lib/queries/brands";
import type { MonthlySales, GrowthProduct, ReturnRate, BuyerTypeSummary, BuyerMonthly } from "@/lib/types";
import { toDateStr } from "@/lib/date";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; brandCd: string }> }
) {
  const { id, brandCd } = await params;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 180);

  try {
    const [monthly, growth, returnRate, buyerType, buyerMonthly] = await queryBatch<[MonthlySales[], GrowthProduct[], ReturnRate[], BuyerTypeSummary[], BuyerMonthly[]]>([
      brandMonthlySalesSQL(id, brandCd, 6),
      brandTopGrowthProductsSQL(id, brandCd),
      brandReturnRateSQL(id, brandCd, start, end),
      brandBuyerTypeSQL(id, brandCd, start, end),
      brandBuyerMonthlySQL(id, brandCd, 6),
    ]);

    return NextResponse.json({
      monthly, growth,
      returnRate: returnRate[0] ?? null,
      buyerType,
      buyerTypePeriod: { start: toDateStr(start), end: toDateStr(end) },
      buyerMonthly,
    });
  } catch (e) {
    console.error("Brand insights error:", e);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

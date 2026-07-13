import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import {
  partnerMonthlySalesSQL,
  partnerWeeklySalesSQL,
  partnerTopGrowthProductsSQL,
  partnerReturnRateSQL,
  partnerBuyerTypeSQL,
  partnerBuyerMonthlySQL,
} from "@/lib/queries/insights";
import type { MonthlySales, WeeklySales, GrowthProduct, ReturnRate, BuyerTypeSummary, BuyerMonthly } from "@/lib/types";

function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 180);

  try {
    const [monthly, weekly, growth, returnRate, buyerType, buyerMonthly] = await queryBatch<[MonthlySales[], WeeklySales[], GrowthProduct[], ReturnRate[], BuyerTypeSummary[], BuyerMonthly[]]>([
      partnerMonthlySalesSQL(id, 6),
      partnerWeeklySalesSQL(id, 12),
      partnerTopGrowthProductsSQL(id),
      partnerReturnRateSQL(id, start, end),
      partnerBuyerTypeSQL(id, start, end),
      partnerBuyerMonthlySQL(id, 6),
    ]);

    return NextResponse.json({
      monthly, weekly, growth,
      returnRate: returnRate[0] ?? null,
      buyerType,
      buyerTypePeriod: { start: toDateStr(start), end: toDateStr(end) },
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

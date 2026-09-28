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
import { parseSalesBasis } from "@/lib/queries/salesLines";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 180);

  // 브랜드별 신규/재구매는 promotion-manager 위탁사 화면만 쓰고 5~6초가 더 들므로, 이 사이트의
  // 파트너 상세가 그 값을 기다리지 않게 `?include=byBrand` 일 때만 돕니다(PR #58 리뷰).
  const include = new Set((req.nextUrl.searchParams.get("include") ?? "").split(",").map((s) => s.trim()));
  const withByBrand = include.has("byBrand");
  // ?basis=partner — 위탁사 기준 매출(이슈 #63). 없으면 태블로 실매출
  const basis = parseSalesBasis(req.nextUrl.searchParams.get("basis"));

  try {
    const [monthly, weekly, growth, returnRate, buyerType, buyerMonthly, buyerTypeByBrand] = await queryBatch<
      [MonthlySales[], WeeklySales[], GrowthProduct[], ReturnRate[], BuyerTypeSummary[], BuyerMonthly[], BuyerTypeByBrand[]]
    >([
      partnerMonthlySalesSQL(id, 6, basis),
      partnerWeeklySalesSQL(id, 12, basis),
      partnerTopGrowthProductsSQL(id, basis),
      partnerReturnRateSQL(id, start, end),
      partnerBuyerTypeSQL(id, start, end, basis),
      partnerBuyerMonthlySQL(id, 6, basis),
      ...(withByBrand ? [partnerBuyerTypeByBrandSQL(id, start, end, basis)] : []),
    ]);

    return NextResponse.json({
      basis,
      monthly, weekly, growth,
      returnRate: returnRate[0] ?? null,
      buyerType,
      buyerTypePeriod: { start: toDateStr(start), end: toDateStr(end) },
      buyerMonthly,
      // 브랜드별 신규/재구매 — buyerType 과 같은 180일 창·같은 첫 주문 기준. include=byBrand 일 때만
      ...(withByBrand ? { buyerTypeByBrand } : {}),
    });
  } catch (e) {
    console.error("Partner insights error:", e);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

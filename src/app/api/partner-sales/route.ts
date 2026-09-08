import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cached } from "@/lib/cache";
import { partnerMonthlySalesByNameSQL } from "@/lib/queries/partnerSales";
import type { PartnerSalesSeries, PartnerSalesYearResponse } from "@/lib/types";

// 공헌이익 대시보드처럼 바깥 화면이 파트너사별 매출을 공급사명으로 붙일 때 쓴다.
// 연 단위 조회라 무거워 인스턴스 메모리에 10분 담아 둔다.
const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_YEAR = 2020;

interface Row {
  partner_name: string;
  partner_id: number;
  month: number;
  order_count: number;
  total_sales: number | string;
}

async function load(year: number): Promise<PartnerSalesYearResponse> {
  const rows = await query<Row>(partnerMonthlySalesByNameSQL(year));

  const byName = new Map<string, PartnerSalesSeries>();
  for (const row of rows) {
    const name = row.partner_name?.trim();
    const month = Number(row.month);
    if (!name || month < 1 || month > 12) continue;

    let entry = byName.get(name);
    if (!entry) {
      entry = {
        partner_id: row.partner_id === null ? null : Number(row.partner_id),
        partner_name: name,
        sales: Array.from({ length: 12 }, () => 0),
        order_count: Array.from({ length: 12 }, () => 0),
        sales_total: 0,
      };
      byName.set(name, entry);
    }
    const sales = Number(row.total_sales) || 0;
    entry.sales[month - 1] += sales;
    entry.order_count[month - 1] += Number(row.order_count) || 0;
    entry.sales_total += sales;
  }

  const partners = [...byName.values()].sort((a, b) => b.sales_total - a.sales_total);
  const months = Array.from({ length: 12 }, (_, i) =>
    partners.reduce((sum, p) => sum + p.sales[i], 0)
  );

  return { year, months, partners };
}

export async function GET(req: NextRequest) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = Number(req.nextUrl.searchParams.get("year") || now.getUTCFullYear());

  if (!Number.isInteger(year) || year < MIN_YEAR || year > now.getUTCFullYear() + 1) {
    return NextResponse.json({ error: "year 값이 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const data = await cached(`partner-sales:${year}`, CACHE_TTL_MS, () => load(year));
    return NextResponse.json(data);
  } catch (e) {
    console.error("Partner sales error:", e);
    return NextResponse.json(
      { error: "파트너사별 매출을 불러오지 못했습니다" },
      { status: 500 }
    );
  }
}

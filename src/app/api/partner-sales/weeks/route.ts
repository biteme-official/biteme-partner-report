import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cached } from "@/lib/cache";
import { monthWeekRanges } from "@/lib/date";
import { partnerWeeklySalesByNameSQL } from "@/lib/queries/partnerSales";
import type { PartnerSalesSeries, PartnerSalesWeekResponse } from "@/lib/types";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_YEAR = 2020;

interface Row {
  partner_name: string;
  partner_id: number;
  week_no: number | null;
  order_count: number;
  total_sales: number | string;
}

async function load(year: number, month: number): Promise<PartnerSalesWeekResponse> {
  const weeks = monthWeekRanges(year, month);
  const rows = await query<Row>(partnerWeeklySalesByNameSQL(weeks));

  const byName = new Map<string, PartnerSalesSeries>();
  for (const row of rows) {
    const name = row.partner_name?.trim();
    const no = Number(row.week_no);
    if (!name || !no || no < 1 || no > weeks.length) continue;

    let entry = byName.get(name);
    if (!entry) {
      entry = {
        partner_id: row.partner_id === null ? null : Number(row.partner_id),
        partner_name: name,
        sales: weeks.map(() => 0),
        order_count: weeks.map(() => 0),
        sales_total: 0,
      };
      byName.set(name, entry);
    }
    const sales = Number(row.total_sales) || 0;
    entry.sales[no - 1] += sales;
    entry.order_count[no - 1] += Number(row.order_count) || 0;
    entry.sales_total += sales;
  }

  return {
    year,
    month,
    weeks,
    partners: [...byName.values()].sort((a, b) => b.sales_total - a.sales_total),
  };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));

  if (!Number.isInteger(year) || year < MIN_YEAR || year > now.getUTCFullYear() + 1) {
    return NextResponse.json({ error: "year 값이 올바르지 않습니다" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month 는 1~12 여야 합니다" }, { status: 400 });
  }

  try {
    const data = await cached(`partner-sales:weeks:${year}-${month}`, CACHE_TTL_MS, () =>
      load(year, month)
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error("Partner weekly sales error:", e);
    return NextResponse.json(
      { error: "주차별 매출을 불러오지 못했습니다" },
      { status: 500 }
    );
  }
}

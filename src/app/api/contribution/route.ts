import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import { cached } from "@/lib/cache";
import { readSheetRanges } from "@/lib/sheets";
import {
  CONTRIBUTION_SHEET_ID,
  CONTRIBUTION_YEARS,
  parseYearTab,
  yearTabName,
} from "@/lib/contribution";
import { partnerAllListSQL } from "@/lib/queries/partners";
import { partnerMonthlySalesByNameSQL } from "@/lib/queries/contribution";
import type {
  ContributionPartnerRow,
  ContributionYearResponse,
  PartnerBasic,
} from "@/lib/types";

const CACHE_TTL_MS = 10 * 60 * 1000;

interface MonthlySalesRow {
  partner_name: string;
  month: number;
  order_count: number;
  total_sales: number | string;
}

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function zeros(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

async function load(year: number): Promise<ContributionYearResponse> {
  const [sheetRows, [partnerRows, salesRows]] = await Promise.all([
    readSheetRanges(CONTRIBUTION_SHEET_ID, [`'${yearTabName(year)}'!A1:Z1000`]),
    queryBatch<[PartnerBasic[], MonthlySalesRow[]]>([
      partnerAllListSQL(),
      partnerMonthlySalesByNameSQL(year),
    ]),
  ]);

  const sheet = parseYearTab(sheetRows[0]);

  const idByName = new Map<string, number>();
  for (const p of partnerRows) {
    const name = p.partner_name?.trim();
    if (name && !idByName.has(name)) idByName.set(name, Number(p.partner_id));
  }

  const salesByName = new Map<string, { sales: number[]; orders: number[] }>();
  for (const row of salesRows) {
    const name = row.partner_name?.trim();
    const month = Number(row.month);
    if (!name || month < 1 || month > 12) continue;
    let entry = salesByName.get(name);
    if (!entry) {
      entry = { sales: zeros(), orders: zeros() };
      salesByName.set(name, entry);
    }
    entry.sales[month - 1] += Number(row.total_sales) || 0;
    entry.orders[month - 1] += Number(row.order_count) || 0;
  }

  const partners: ContributionPartnerRow[] = [];
  const unmatchedSheetPartners: string[] = [];

  for (const name of sheet.partnerOrder) {
    const contribution = sheet.byPartner.get(name) ?? zeros();
    const sale = salesByName.get(name);
    if (!idByName.has(name)) unmatchedSheetPartners.push(name);
    partners.push({
      partner_id: idByName.get(name) ?? null,
      partner_name: name,
      contribution,
      sales: sale?.sales ?? zeros(),
      orders: sale?.orders ?? zeros(),
      contribution_total: contribution.reduce((a, b) => a + b, 0),
      sales_total: (sale?.sales ?? []).reduce((a, b) => a + b, 0),
      in_sheet: true,
    });
  }

  // 매출은 있는데 시트에 공헌이익 행이 없는 파트너사 — 비율 계산에서 빼되 규모는 알려준다
  let salesOnlyCount = 0;
  let salesOnlyTotal = 0;
  for (const [name, sale] of salesByName) {
    if (sheet.byPartner.has(name)) continue;
    const total = sale.sales.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    salesOnlyCount += 1;
    salesOnlyTotal += total;
    partners.push({
      partner_id: idByName.get(name) ?? null,
      partner_name: name,
      contribution: zeros(),
      sales: sale.sales,
      orders: sale.orders,
      contribution_total: 0,
      sales_total: total,
      in_sheet: false,
    });
  }

  const now = kstNow();
  const currentMonth = now.getUTCFullYear() === year ? now.getUTCMonth() + 1 : null;

  const months = Array.from({ length: 12 }, (_, i) => {
    let contribution = 0;
    let sales = 0;
    let orderCount = 0;
    for (const p of partners) {
      if (!p.in_sheet) continue; // 합계는 공헌이익을 아는 파트너사 기준
      contribution += p.contribution[i];
      sales += p.sales[i];
      orderCount += p.orders[i];
    }
    return {
      month: i + 1,
      contribution,
      sales,
      order_count: orderCount,
      partial: currentMonth !== null && i + 1 >= currentMonth,
    };
  });

  return {
    year,
    months,
    partners,
    meta: {
      sheet_partner_count: sheet.partnerOrder.length,
      matched_partner_count: sheet.partnerOrder.length - unmatchedSheetPartners.length,
      unmatched_sheet_partners: unmatchedSheetPartners,
      sales_only_partner_count: salesOnlyCount,
      sales_only_total: salesOnlyTotal,
      current_month: currentMonth,
    },
  };
}

export async function GET(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year") || CONTRIBUTION_YEARS.at(-1));

  if (!CONTRIBUTION_YEARS.includes(year as (typeof CONTRIBUTION_YEARS)[number])) {
    return NextResponse.json(
      { error: `지원하지 않는 연도입니다 (${CONTRIBUTION_YEARS.join(", ")})` },
      { status: 400 }
    );
  }

  try {
    const data = await cached(`contribution:${year}`, CACHE_TTL_MS, () => load(year));
    return NextResponse.json(data);
  } catch (e) {
    console.error("Contribution error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "공헌이익 데이터를 불러오지 못했습니다" },
      { status: 500 }
    );
  }
}

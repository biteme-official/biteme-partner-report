import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import { cached } from "@/lib/cache";
import { readSheetRanges, readSheetTitles } from "@/lib/sheets";
import {
  CONTRIBUTION_SHEET_ID,
  CONTRIBUTION_YEARS,
  monthTabName,
  monthWeekRanges,
  parseMonthTab,
} from "@/lib/contribution";
import { partnerAllListSQL } from "@/lib/queries/partners";
import { partnerWeeklySalesByNameSQL } from "@/lib/queries/contribution";
import type {
  ContributionWeekPartnerRow,
  ContributionWeekResponse,
  PartnerBasic,
} from "@/lib/types";

const CACHE_TTL_MS = 10 * 60 * 1000;
const TITLES_TTL_MS = 30 * 60 * 1000;

interface WeeklySalesRow {
  partner_name: string;
  week_no: number | null;
  order_count: number;
  total_sales: number | string;
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function load(year: number, month: number): Promise<ContributionWeekResponse> {
  const weeks = monthWeekRanges(year, month);
  const tab = monthTabName(year, month);

  const titles = await cached(`sheetTitles:${CONTRIBUTION_SHEET_ID}`, TITLES_TTL_MS, () =>
    readSheetTitles(CONTRIBUTION_SHEET_ID)
  );
  const sheetAvailable = titles.includes(tab);

  const [sheetRows, [partnerRows, salesRows]] = await Promise.all([
    sheetAvailable
      ? readSheetRanges(CONTRIBUTION_SHEET_ID, [`'${tab}'!A1:Z1000`])
      : Promise.resolve([[]]),
    queryBatch<[PartnerBasic[], WeeklySalesRow[]]>([
      partnerAllListSQL(),
      partnerWeeklySalesByNameSQL(weeks),
    ]),
  ]);

  const sheet = sheetAvailable
    ? parseMonthTab(sheetRows[0])
    : { basisLabel: "", sheetWeekCount: 0, byPartner: new Map<string, number[]>() };

  const idByName = new Map<string, number>();
  for (const p of partnerRows) {
    const name = p.partner_name?.trim();
    if (name && !idByName.has(name)) idByName.set(name, Number(p.partner_id));
  }

  const zeros = () => weeks.map(() => 0);

  const salesByName = new Map<string, { sales: number[]; orders: number[] }>();
  for (const row of salesRows) {
    const name = row.partner_name?.trim();
    const no = Number(row.week_no);
    if (!name || !no || no < 1 || no > weeks.length) continue;
    let entry = salesByName.get(name);
    if (!entry) {
      entry = { sales: zeros(), orders: zeros() };
      salesByName.set(name, entry);
    }
    entry.sales[no - 1] += Number(row.total_sales) || 0;
    entry.orders[no - 1] += Number(row.order_count) || 0;
  }

  const names = new Set<string>([...sheet.byPartner.keys(), ...salesByName.keys()]);
  const partners: ContributionWeekPartnerRow[] = [];
  for (const name of names) {
    const contribution = (sheet.byPartner.get(name) ?? zeros()).slice(0, weeks.length);
    while (contribution.length < weeks.length) contribution.push(0);
    const sales = salesByName.get(name)?.sales ?? zeros();
    const contributionTotal = contribution.reduce((a, b) => a + b, 0);
    const salesTotal = sales.reduce((a, b) => a + b, 0);
    if (contributionTotal === 0 && salesTotal === 0) continue;
    partners.push({
      partner_id: idByName.get(name) ?? null,
      partner_name: name,
      contribution,
      sales,
      contribution_total: contributionTotal,
      sales_total: salesTotal,
    });
  }
  partners.sort((a, b) => b.contribution_total - a.contribution_total);

  const today = kstToday();
  const weekPoints = weeks.map((w, i) => {
    let contribution = 0;
    let sales = 0;
    let orderCount = 0;
    for (const p of partners) {
      contribution += p.contribution[i];
      sales += p.sales[i];
    }
    for (const entry of salesByName.values()) orderCount += entry.orders[i];
    return {
      week_no: w.no,
      start: w.start,
      end: w.end,
      contribution,
      sales,
      order_count: orderCount,
      partial: w.end >= today,
    };
  });

  // 시트는 주차 열을 6개까지 미리 깔아두므로, 남는 열에 값이 있을 때만 경고한다
  let overflow = 0;
  if (sheet.sheetWeekCount > weeks.length) {
    for (const values of sheet.byPartner.values()) {
      for (let i = weeks.length; i < values.length; i++) overflow += values[i];
    }
  }

  let warning: string | null = null;
  if (sheetAvailable && (sheet.sheetWeekCount < weeks.length || overflow !== 0)) {
    warning =
      `시트 '${tab}' 탭의 주차 열은 ${sheet.sheetWeekCount}개인데 ` +
      `${year}년 ${month}월의 주(월~일)는 ${weeks.length}개입니다. ` +
      `앞에서부터 ${Math.min(sheet.sheetWeekCount, weeks.length)}개만 맞춰 표시합니다` +
      (overflow !== 0 ? ` — 남는 열에 ${Math.round(overflow).toLocaleString("ko-KR")}원이 남습니다.` : ".");
  } else if (!sheetAvailable) {
    warning = `시트에 '${tab}' 탭이 없어 주차별 공헌이익은 비어 있습니다. 거래액만 표시합니다.`;
  }

  return {
    year,
    month,
    sheet_available: sheetAvailable,
    basis_label: sheet.basisLabel,
    weeks: weekPoints,
    partners,
    week_count_warning: warning,
  };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));

  if (!CONTRIBUTION_YEARS.includes(year as (typeof CONTRIBUTION_YEARS)[number])) {
    return NextResponse.json(
      { error: `지원하지 않는 연도입니다 (${CONTRIBUTION_YEARS.join(", ")})` },
      { status: 400 }
    );
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month 는 1~12 여야 합니다" }, { status: 400 });
  }

  try {
    const data = await cached(`contribution:weeks:${year}-${month}`, CACHE_TTL_MS, () =>
      load(year, month)
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error("Contribution weeks error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "주차별 공헌이익을 불러오지 못했습니다" },
      { status: 500 }
    );
  }
}

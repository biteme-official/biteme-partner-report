import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { CATEGORY_MAJORS } from "@/lib/categoryMajors";
import { loadCategoryPeriod } from "@/lib/categoryFold";

/** 지난 달은 바뀌지 않습니다 — 프로모션 센터도 따로 오래 캐시합니다 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** 이번 달 — 주문이 계속 들어옵니다 */
const LIVE_CACHE_TTL_MS = 10 * 60 * 1000;

export const maxDuration = 60;

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 주문 데이터 첫 달 — 2024-08-26 부터 있습니다 */
const FIRST_MONTH = "2024-08";

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const lastDay = (ym: string) =>
  `${ym}-${String(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;

/**
 * 월별 카테고리 매출 — 프로모션 센터 「카테고리 매출」 탭의 월별 흐름 (이슈 #77).
 *   GET /api/category-monthly?month=YYYY-MM
 *
 * 그 달 1일 ~ 말일(이번 달이면 오늘)의 위탁사 × 브랜드 × 대분류 거래액. 배정 규칙·원천은 `/api/category-sales`(#75)와 같습니다.
 * major 가 null 이면 카테고리 미지정. sales = 태블로 실매출, partner_sales = 거래액(위탁사 기준).
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const today = kstToday();
  if (!YM.test(month) || month < FIRST_MONTH || month > today.slice(0, 7)) {
    return NextResponse.json({ error: `month (YYYY-MM, ${FIRST_MONTH} ~ this month) is required` }, { status: 400 });
  }
  const start = `${month}-01`;
  const end = month === today.slice(0, 7) ? today : lastDay(month);
  const ttl = end >= today ? LIVE_CACHE_TTL_MS : CACHE_TTL_MS;

  try {
    const data = await cached(`category-monthly:v2:${month}:${end}`, ttl, async () => {
      // 기간 조회와 같은 접기(상품 줄 단위 반올림)를 위탁사 × 브랜드 × 대분류로 더합니다 — 같은 기간이면 원 단위까지 일치 (#79)
      const { products } = await loadCategoryPeriod({ start, end });
      const by = new Map<string, { partner_id: number; brand_cd: string; major: string | null; sales: number; partner_sales: number }>();
      for (const p of products) {
        const k = `${p.partner_id}\u0000${p.brand_cd}\u0000${p.major ?? ""}`;
        const r = by.get(k) ?? { partner_id: p.partner_id, brand_cd: p.brand_cd, major: p.major, sales: 0, partner_sales: 0 };
        r.sales += p.sales;
        r.partner_sales += p.partner_sales;
        by.set(k, r);
      }
      return { month, period: { start, end }, majors: CATEGORY_MAJORS, rows: [...by.values()] };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Category monthly sales error:", e);
    return NextResponse.json({ error: "월별 카테고리 매출을 불러오지 못했습니다" }, { status: 500 });
  }
}

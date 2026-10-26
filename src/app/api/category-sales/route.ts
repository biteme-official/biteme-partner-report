import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cached } from "@/lib/cache";
import { CATEGORY_MAJORS } from "@/lib/categoryMajors";
import { categoryNamesSQL } from "@/lib/queries/categorySales";
import { loadCategoryPeriod } from "@/lib/categoryFold";

/** 지난 기간은 바뀌지 않습니다 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** 오늘이 든 기간 — 주문이 계속 들어옵니다 */
const LIVE_CACHE_TTL_MS = 10 * 60 * 1000;

export const maxDuration = 60;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 직접 입력 기간 상한 — 1년 남짓 */
const MAX_DAYS = 400;

const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const days = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

interface NameRow {
  category_cd: string;
  category_nm: string;
  pet_type: string | null;
  active: number | string;
}

/**
 * 카테고리별 매출 — 프로모션 센터 관리자 매출통계 「카테고리 매출」 탭 (이슈 #75).
 *   GET /api/category-sales?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * products  상품 × 위탁사 × 브랜드 — 배정한 대분류(major)·중분류(mid). major 가 null 이면 미지정이고,
 *           repre_major 는 그 상품의 대표 카테고리(대상 밖일 수 있음 — 미지정 목록에서 원인 보기용)
 *           sales = 태블로 실매출, partner_sales = 거래액(위탁사 기준)
 * orders    주문 수 — level all / major / mid (주문 번호로 따로 셈)
 * majors    대상 대분류(쇼핑몰 메뉴 순서), categories 는 wt_category 이름(active = 사용 중·삭제 안 됨)
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  if (!YMD.test(start) || !YMD.test(end) || end < start) {
    return NextResponse.json({ error: "start, end (YYYY-MM-DD, start ≤ end) are required" }, { status: 400 });
  }
  if (days(start, end) > MAX_DAYS) {
    return NextResponse.json({ error: `period must be ${MAX_DAYS} days or less` }, { status: 400 });
  }
  const range = { start, end };
  const ttl = end >= kstToday() ? LIVE_CACHE_TTL_MS : CACHE_TTL_MS;

  try {
    const data = await cached(`category-sales:v3:${start}:${end}`, ttl, async () => {
      // 배정(6시간 캐시)·주문 라인·이름을 함께 — 접기는 lib/categoryFold.ts (#79)
      const [{ products, orders }, names] = await Promise.all([loadCategoryPeriod(range), query<NameRow>(categoryNamesSQL())]);
      return {
        period: { start, end },
        majors: CATEGORY_MAJORS,
        categories: names.map((r) => ({ cd: String(r.category_cd), name: String(r.category_nm), pet_type: str(r.pet_type), active: num(r.active) === 1 })),
        products,
        orders,
      };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Category sales error:", e);
    return NextResponse.json({ error: "카테고리별 매출을 불러오지 못했습니다" }, { status: 500 });
  }
}

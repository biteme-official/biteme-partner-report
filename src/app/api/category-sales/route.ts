import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import { cached } from "@/lib/cache";
import { CATEGORY_MAJORS } from "@/lib/categoryMajors";
import {
  categoryNamesSQL,
  categoryOrderCountsSQL,
  categoryProductSalesSQL,
} from "@/lib/queries/categorySales";

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

interface ProductRow {
  product_cd: string;
  product_nm: string | null;
  partner_id: number | string;
  partner_name: string | null;
  brand_cd: string | null;
  brand_nm: string | null;
  major: string | null;
  mid: string | null;
  repre_major: string | null;
  order_count: number | string;
  qty: number | string;
  sales: number | string;
  partner_sales: number | string;
}

interface OrderRow {
  level: "all" | "major" | "mid";
  major: string | null;
  mid: string | null;
  order_count: number | string;
}

interface NameRow {
  category_cd: string;
  category_nm: string;
  pet_type: string | null;
}

/**
 * 카테고리별 매출 — 프로모션 센터 관리자 매출통계 「카테고리 매출」 탭 (이슈 #75).
 *   GET /api/category-sales?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * products  상품 × 위탁사 × 브랜드 — 배정한 대분류(major)·중분류(mid). major 가 null 이면 미지정이고,
 *           repre_major 는 그 상품의 대표 카테고리(대상 밖일 수 있음 — 미지정 목록에서 원인 보기용)
 *           sales = 태블로 실매출, partner_sales = 거래액(위탁사 기준)
 * orders    주문 수 — level all / major / mid (주문 번호로 따로 셈)
 * majors    대상 대분류(쇼핑몰 메뉴 순서), categories 는 wt_category 이름
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
  if (params.get("debug") === "columns") {
    const out: Record<string, unknown> = {};
    const qs: Record<string, string> = {
      cols: "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('wt_product_category','wt_category') ORDER BY TABLE_NAME, ORDINAL_POSITION",
      sample: "SELECT pc.* FROM wt_product_category pc JOIN (SELECT DISTINCT product_cd FROM wt_product_category WHERE category1_cd = '031004' ORDER BY product_cd DESC LIMIT 3) x ON x.product_cd = pc.product_cd",
      catSample: "SELECT * FROM wt_category WHERE category_cd LIKE '031004%' LIMIT 5",
    };
    for (const [k, q] of Object.entries(qs)) {
      try {
        out[k] = (await queryBatch<[unknown[]]>([q]))[0];
      } catch (e) {
        out[k] = String((e as { sqlMessage?: string }).sqlMessage ?? e);
      }
    }
    return NextResponse.json(out);
  }
  const ttl = end >= kstToday() ? LIVE_CACHE_TTL_MS : CACHE_TTL_MS;

  try {
    const data = await cached(`category-sales:v1:${start}:${end}`, ttl, async () => {
      const [products, orders, names] = await queryBatch<[ProductRow[], OrderRow[], NameRow[]]>([
        categoryProductSalesSQL(range),
        categoryOrderCountsSQL(range),
        categoryNamesSQL(),
      ]);
      return {
        period: { start, end },
        majors: CATEGORY_MAJORS,
        categories: names.map((r) => ({ cd: String(r.category_cd), name: String(r.category_nm), pet_type: str(r.pet_type) })),
        products: products.map((r) => ({
          product_cd: String(r.product_cd),
          product_nm: r.product_nm ?? "",
          partner_id: num(r.partner_id),
          partner_name: r.partner_name ?? "",
          brand_cd: r.brand_cd ?? "",
          brand_nm: r.brand_nm ?? "",
          major: str(r.major),
          mid: str(r.mid),
          repre_major: str(r.repre_major),
          order_count: num(r.order_count),
          qty: num(r.qty),
          sales: num(r.sales),
          partner_sales: num(r.partner_sales),
        })),
        orders: orders.map((r) => ({
          level: r.level,
          major: str(r.major),
          mid: str(r.mid),
          order_count: num(r.order_count),
        })),
      };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Category sales error:", e);
    const err = e as { code?: string; sqlMessage?: string };
    return NextResponse.json({ error: "카테고리별 매출을 불러오지 못했습니다", debug: `${err.code ?? ""} ${err.sqlMessage ?? ""}` }, { status: 500 });
  }
}

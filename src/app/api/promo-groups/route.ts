import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cached } from "@/lib/cache";
import {
  brandGroupStatsSQL,
  groupInfoSQL,
  groupKind,
  OWN_PARTNER_ID,
  ownBrandDailySQL,
  ownBrandSalesSQL,
  promoGroupBrandsSQL,
  promoGroupsSQL,
} from "@/lib/queries/promoGroups";

/** 할인율 계산(가격 로그 구간)은 분기 하나에 7~8초라 길게 둡니다. 지난 전시는 바뀌지 않습니다 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** 진행 중이거나 앞으로 열릴 전시가 든 범위 — 상품 구성·가격이 하루에도 바뀝니다 */
const LIVE_CACHE_TTL_MS = 30 * 60 * 1000;

export const maxDuration = 60;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const BRAND_CD = /^[A-Za-z0-9_-]{1,20}$/;
/**
 * 목록·브랜드 조회 기간 상한 — 3년 (목록 2.5초, 브랜드 하나 10~20초).
 * 프로모션 센터는 주문 데이터 첫날(2024-08-26)부터 오늘까지 부르므로, 800 이면 2026-11-03 부터 400 이 납니다.
 */
const MAX_DAYS = 1100;
/**
 * 전시 × 브랜드 할인율(stats=1) 기간 상한 — 한 분기.
 * 메인급 전시 전체를 2년치 한 번에 내면 운영 DB 에서 1분이 넘게 걸립니다(분기 하나 7.5초).
 */
const MAX_STATS_DAYS = 92;
const DEFAULT_MIN_BRANDS = 20;

const num = (v: unknown) => Number(v) || 0;
const rate = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

interface GroupRow {
  group_cd: number;
  group_nm: string;
  list_type: string | null;
  s: string;
  e: string;
  products: number | string;
  brands: number | string;
  own_products: number | string;
}

interface BrandStatRow {
  group_cd: number;
  brand_cd: string;
  brand_nm: string;
  partner_id: number;
  partner_name: string;
  products: number | string;
  avg_rate: number | string | null;
  max_rate: number | string | null;
}

const group = (minBrands: number) => (r: GroupRow) => {
  const size = { products: num(r.products), brands: num(r.brands), own_products: num(r.own_products) };
  return {
    group_cd: Number(r.group_cd),
    name: String(r.group_nm ?? ""),
    list_type: r.list_type ?? null,
    start: r.s,
    end: r.e,
    /** products·brands 는 위탁 상품·브랜드만, own_products 는 바잇미 자체 상품 수 */
    ...size,
    /** main = 위탁 브랜드 minBrands 곳 이상 · pb = 자체 상품 기획전 · null = 그 밖(브랜드위크 등) */
    kind: groupKind(size, minBrands),
  };
};

const brandStat = (r: BrandStatRow) => ({
  group_cd: Number(r.group_cd),
  brand_cd: String(r.brand_cd),
  brand_nm: String(r.brand_nm ?? r.brand_cd),
  partner_id: Number(r.partner_id),
  partner_name: String(r.partner_name ?? ""),
  products: num(r.products),
  /** 바잇미 자체 상품 — partner_id 0 「바잇미 자체」로 묶여 옵니다 */
  own: Number(r.partner_id) === OWN_PARTNER_ID,
  /** 전시 기간 중 가장 낮았던 판매가의 정가 대비 할인율(%) — 가격 로그가 없으면 null */
  avg_rate: rate(r.avg_rate),
  max_rate: rate(r.max_rate),
});

/**
 * 기획전 전시 이력 — 프로모션 센터 「기획전 비교」. `Authorization: Bearer $PROMO_GROUPS_TOKEN` 필수.
 *   GET /api/promo-groups?start&end[&minBrands=20]
 *     위탁 브랜드가 minBrands 곳 이상인 전시(메인급 후보)와 PB 기획전(자체 상품 기획전) 목록. 빠릅니다.
 *   GET /api/promo-groups?start&end&stats=1[&minBrands=20]   (기간 92일 이하)
 *     위 목록 + 전시마다 브랜드별 참여 상품 수·할인율 (자체 상품은 partner_id 0, own: true)
 *   GET /api/promo-groups?start&end&brandCd=9000671[&own=1]
 *     그 브랜드가 올라간 모든 전시(브랜드위크 포함)와 전시마다 그 브랜드의 상품 수·할인율.
 *     own=1 이면 바잇미 자체 상품(partner_id 0), 아니면 위탁 상품
 *   GET /api/promo-groups?start&end&ownSales=1[&brandCd=…]
 *     바잇미 자체 상품 매출 — 브랜드별 합계(/api/integrated 행 모양) 또는 brandCd 를 주면 그 브랜드 일별
 *     (/api/partners/{no}/brands/{cd} 의 sales 모양). 다른 매출 API 는 자체 계정을 빼서 PB 기획전용으로 둡니다.
 * 할인율 산식은 src/lib/queries/promoGroups.ts.
 */
export async function GET(req: NextRequest) {
  // 이 리포트의 다른 API 와 달리 토큰이 있어야 답합니다 — 공개 주소라 누구나 부를 수 있고,
  // 전 위탁사의 기획전 참여·할인 이력이 한 번에 나가기 때문입니다. 토큰이 설정돼 있지 않으면 닫습니다.
  const token = process.env.PROMO_GROUPS_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  if (!YMD.test(start) || !YMD.test(end) || end < start) {
    return NextResponse.json({ error: "start, end (YYYY-MM-DD, start ≤ end) are required" }, { status: 400 });
  }
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1;
  const stats = params.get("stats") === "1";
  const limit = stats ? MAX_STATS_DAYS : MAX_DAYS;
  if (days > limit) {
    return NextResponse.json({ error: `period must be ${limit} days or less` }, { status: 400 });
  }
  const range = { start, end };
  const ttl = end >= kstToday() ? LIVE_CACHE_TTL_MS : CACHE_TTL_MS;
  const brandCd = params.get("brandCd");
  if (brandCd !== null && !BRAND_CD.test(brandCd)) {
    return NextResponse.json({ error: "invalid brandCd" }, { status: 400 });
  }
  const minBrands = Math.max(1, Math.min(200, Number(params.get("minBrands")) || DEFAULT_MIN_BRANDS));

  try {
    if (params.get("ownSales") === "1") {
      const from = new Date(`${start}T00:00:00`);
      const to = new Date(`${end}T23:59:59`);
      if (brandCd !== null) {
        const sales = await cached(`promo-groups:own-daily:${start}:${end}:${brandCd}`, ttl, () =>
          query(ownBrandDailySQL(brandCd, from, to))
        );
        return NextResponse.json({ period: range, brandCd, sales });
      }
      const brands = await cached(`promo-groups:own-sales:${start}:${end}`, ttl, () => query(ownBrandSalesSQL(from, to)));
      return NextResponse.json({ period: range, brands });
    }

    if (brandCd !== null) {
      const own = params.get("own") === "1";
      const data = await cached(`promo-groups:brand:${start}:${end}:${brandCd}:${own ? 1 : 0}`, ttl, async () => {
        const brands = await query<BrandStatRow>(brandGroupStatsSQL(range, brandCd, own));
        const groups = brands.length
          ? await query<GroupRow>(groupInfoSQL([...new Set(brands.map((b) => Number(b.group_cd)))]))
          : [];
        return { period: range, brandCd, own, groups: groups.map(group(minBrands)), brands: brands.map(brandStat) };
      });
      return NextResponse.json(data);
    }

    const data = await cached(`promo-groups:v2:${start}:${end}:${minBrands}:${stats ? 1 : 0}`, ttl, async () => {
      const groups = await query<GroupRow>(promoGroupsSQL(range, minBrands));
      const brands =
        stats && groups.length
          ? await query<BrandStatRow>(promoGroupBrandsSQL(groups.map((g) => Number(g.group_cd))))
          : [];
      return {
        period: range,
        minBrands,
        groups: groups.map(group(minBrands)),
        ...(stats ? { brands: brands.map(brandStat) } : {}),
      };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Promo groups error:", e);
    return NextResponse.json({ error: "기획전 전시 이력을 불러오지 못했습니다" }, { status: 500 });
  }
}

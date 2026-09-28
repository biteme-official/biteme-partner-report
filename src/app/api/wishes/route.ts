import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import { brandWishSQL, topProductWishSQL } from "@/lib/queries/wishes";
import type { BrandWish, ProductWish, WishesResponse } from "@/lib/types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 위탁사당 돌려줄 상위 상품 수 상한 */
const MAX_TOP = 20;

/**
 * 찜 집계 — 전체 위탁사 몫을 한 번에.
 *   GET /api/wishes?start=YYYY-MM-DD&end=YYYY-MM-DD[&top=5][&partnerId=1351]
 * partnerId 를 주면 그 위탁사 몫만 돌려줍니다(매출통계 위탁사 화면).
 * 정의와 키 맞추기는 `lib/queries/wishes.ts` 머리말을 보세요.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  if (!YMD.test(start) || !YMD.test(end) || end < start) {
    return NextResponse.json(
      { error: "start, end (YYYY-MM-DD, start ≤ end) are required" },
      { status: 400 }
    );
  }
  const top = Math.min(MAX_TOP, Math.max(1, Number(params.get("top")) || 5));
  const partnerParam = params.get("partnerId");
  const partnerId = partnerParam === null ? undefined : Number(partnerParam);
  if (partnerId !== undefined && (!Number.isInteger(partnerId) || partnerId <= 0)) {
    return NextResponse.json({ error: "partnerId must be a positive integer" }, { status: 400 });
  }

  try {
    const [brands, products] = await queryBatch<[BrandWish[], ProductWish[]]>([
      brandWishSQL({ start, end, partnerId }),
      topProductWishSQL({ start, end, partnerId }, top),
    ]);
    const body: WishesResponse = {
      period: { start, end },
      brands: brands.map((b) => ({
        brand_cd: String(b.brand_cd),
        brand_nm: String(b.brand_nm ?? b.brand_cd),
        period_wish: Number(b.period_wish) || 0,
        total_wish: Number(b.total_wish) || 0,
      })),
      products: products.map((p) => ({
        partner_id: Number(p.partner_id),
        partner_name: String(p.partner_name ?? ""),
        product_cd: String(p.product_cd),
        product_nm: String(p.product_nm ?? ""),
        brand_cd: String(p.brand_cd ?? ""),
        product_state: String(p.product_state ?? ""),
        display_yn: String(p.display_yn ?? ""),
        period_wish: Number(p.period_wish) || 0,
        total_wish: Number(p.total_wish) || 0,
      })),
    };
    // partner_id — 위탁사로 좁혀 응답했다는 표시. 받는 쪽(센터)은 이게 없으면 전체 브랜드가 섞인 옛 응답으로 보고 쓰지 않습니다
    return NextResponse.json({ ...body, partner_id: partnerId ?? null });
  } catch (e) {
    console.error("Wishes error:", e);
    return NextResponse.json({ error: "Failed to fetch wishes" }, { status: 500 });
  }
}

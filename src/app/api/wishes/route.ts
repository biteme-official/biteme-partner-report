import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import { brandWishSQL, topProductWishSQL } from "@/lib/queries/wishes";
import type { BrandWish, ProductWish, WishesResponse } from "@/lib/types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 위탁사당 돌려줄 상위 상품 수 상한 */
const MAX_TOP = 20;

/**
 * 찜 집계 — 전체 위탁사 몫을 한 번에.
 *   GET /api/wishes?start=YYYY-MM-DD&end=YYYY-MM-DD[&top=5]
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

  try {
    const [brands, products] = await queryBatch<[BrandWish[], ProductWish[]]>([
      brandWishSQL({ start, end }),
      topProductWishSQL({ start, end }, top),
    ]);
    const body: WishesResponse = {
      period: { start, end },
      brands: brands.map((b) => ({
        brand_cd: String(b.brand_cd),
        period_wish: Number(b.period_wish) || 0,
        total_wish: Number(b.total_wish) || 0,
      })),
      products: products.map((p) => ({
        partner_id: Number(p.partner_id),
        product_cd: String(p.product_cd),
        product_nm: String(p.product_nm ?? ""),
        brand_cd: String(p.brand_cd ?? ""),
        product_state: String(p.product_state ?? ""),
        display_yn: String(p.display_yn ?? ""),
        period_wish: Number(p.period_wish) || 0,
        total_wish: Number(p.total_wish) || 0,
      })),
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("Wishes error:", e);
    return NextResponse.json({ error: "Failed to fetch wishes" }, { status: 500 });
  }
}

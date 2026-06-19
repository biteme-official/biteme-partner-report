import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  partnerDetailSQL,
  partnerSalesSQL,
  partnerProductsSQL,
  partnerBrandsSQL,
} from "@/lib/queries/partners";
import type { PartnerDetail, DailySales, ProductSales, BrandInfo } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;
  const days = Number(searchParams.get("days") || 30);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  try {
    const [detail, sales, products, brands] = await Promise.all([
      query<PartnerDetail>(partnerDetailSQL(id, start, end)),
      query<DailySales>(partnerSalesSQL(id, start, end)),
      query<ProductSales>(partnerProductsSQL(id, start, end)),
      query<BrandInfo>(partnerBrandsSQL(id)),
    ]);

    if (!detail.length) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      detail: detail[0],
      sales,
      products,
      brands,
      period: { start, end, days },
    });
  } catch (e) {
    console.error("Partner detail error:", e);
    return NextResponse.json(
      { error: "Failed to fetch partner detail" },
      { status: 500 }
    );
  }
}

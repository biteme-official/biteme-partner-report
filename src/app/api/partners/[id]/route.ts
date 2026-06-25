import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
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

  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  let start: Date, end: Date;
  if (startDateParam && endDateParam) {
    start = new Date(startDateParam + "T00:00:00");
    end = new Date(endDateParam + "T23:59:59");
  } else {
    const days = Number(searchParams.get("days") || 30);
    end = new Date();
    start = new Date();
    start.setDate(start.getDate() - days);
  }

  try {
    const [detail, sales, products, brands] = await queryBatch<[PartnerDetail[], DailySales[], ProductSales[], BrandInfo[]]>([
      partnerDetailSQL(id, start, end),
      partnerSalesSQL(id, start, end),
      partnerProductsSQL(id, start, end),
      partnerBrandsSQL(id),
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
      period: { start, end },
    });
  } catch (e) {
    console.error("Partner detail error:", e);
    return NextResponse.json(
      { error: "Failed to fetch partner detail" },
      { status: 500 }
    );
  }
}

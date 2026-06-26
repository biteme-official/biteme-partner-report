import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import {
  partnerDetailSQL,
  partnerSalesSQL,
  partnerHourlySalesSQL,
  partnerProductsSQL,
  partnerBrandsSQL,
} from "@/lib/queries/partners";
import type { PartnerDetail, DailySales, HourlySales, ProductSales, BrandInfo } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;

  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  let start: Date, end: Date;
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const isHourly = !!startDateParam && !!endDateParam && startDateParam === endDateParam && startDateParam === todayStr;

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
    const salesSQL = isHourly
      ? partnerHourlySalesSQL(id, start, end)
      : partnerSalesSQL(id, start, end);

    const [detail, sales, products, brands] = await queryBatch<[PartnerDetail[], (DailySales | HourlySales)[], ProductSales[], BrandInfo[]]>([
      partnerDetailSQL(id, start, end),
      salesSQL,
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
      granularity: isHourly ? "hourly" : "daily",
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

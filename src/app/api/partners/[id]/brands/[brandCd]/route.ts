import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import {
  brandDetailSQL,
  brandSalesSQL,
  brandHourlySalesSQL,
  brandProductsSQL,
} from "@/lib/queries/brands";
import type { BrandDetail, DailySales, HourlySales, ProductSales } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; brandCd: string }> }
) {
  const { id, brandCd } = await params;
  const searchParams = req.nextUrl.searchParams;

  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  let start: Date, end: Date;
  const isHourly = searchParams.get("granularity") === "hourly";

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
      ? brandHourlySalesSQL(id, brandCd, start, end)
      : brandSalesSQL(id, brandCd, start, end);

    const [detail, sales, products] = await queryBatch<[BrandDetail[], (DailySales | HourlySales)[], ProductSales[]]>([
      brandDetailSQL(id, brandCd),
      salesSQL,
      brandProductsSQL(id, brandCd, start, end),
    ]);

    if (!detail.length) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      detail: detail[0],
      sales,
      granularity: isHourly ? "hourly" : "daily",
      products,
      period: { start, end },
    });
  } catch (e) {
    console.error("Brand detail error:", e);
    return NextResponse.json(
      { error: "Failed to fetch brand detail" },
      { status: 500 }
    );
  }
}

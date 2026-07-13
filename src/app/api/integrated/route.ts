import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { integratedBrandListSQL, subCategoriesFor } from "@/lib/queries/integrated";
import type { IntegratedBrandSummary } from "@/lib/types";

const PERIOD_DAYS = ["7", "30", "90"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const speciesParam = params.get("species") || "all";
  const species = speciesParam === "dog" || speciesParam === "cat" ? speciesParam : "all";
  const subCategory = params.get("subCategory");
  const period = params.get("period") || "30";

  if (species !== "all" && subCategory && !subCategoriesFor(species).includes(subCategory)) {
    return NextResponse.json(
      { error: `invalid subCategory "${subCategory}" for species "${species}"` },
      { status: 400 }
    );
  }

  let start: Date;
  let end: Date;

  if (period === "custom") {
    const startParam = params.get("start");
    const endParam = params.get("end");
    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: "start, end are required for custom period" },
        { status: 400 }
      );
    }
    start = new Date(`${startParam}T00:00:00`);
    end = new Date(`${endParam}T23:59:59`);
  } else {
    const days = Number(PERIOD_DAYS.includes(period) ? period : "30");
    end = new Date();
    start = new Date();
    start.setDate(start.getDate() - days);
  }

  try {
    const brands = await query<IntegratedBrandSummary>(
      integratedBrandListSQL(species, subCategory, start, end)
    );
    return NextResponse.json({ brands, period: { start, end } });
  } catch (e) {
    console.error("Integrated brand list error:", e);
    return NextResponse.json(
      { error: "Failed to fetch integrated brands" },
      { status: 500 }
    );
  }
}

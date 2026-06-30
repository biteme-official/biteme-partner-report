"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailySales, HourlySales } from "@/lib/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("ko-KR");
}

function pctChange(curr: number, prev: number): { label: string; positive: boolean } {
  if (prev === 0 && curr === 0) return { label: "0%", positive: true };
  if (prev === 0) return { label: "+∞%", positive: true };
  const pct = ((curr - prev) / prev) * 100;
  return { label: (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%", positive: pct >= 0 };
}

interface Props {
  sales: DailySales[] | HourlySales[];
  isHourly?: boolean;
  totalSales: number;
  totalOrders: number;
  totalBuyers: number;
  compareSales?: DailySales[] | HourlySales[];
  compareTotalSales?: number;
  compareTotalOrders?: number;
  compareTotalBuyers?: number;
}

export default function SalesOverview({
  sales,
  isHourly,
  totalSales,
  totalOrders,
  totalBuyers,
  compareSales,
  compareTotalSales,
  compareTotalOrders,
  compareTotalBuyers,
}: Props) {
  const hasCompare = !!compareSales && compareSales.length > 0;

  let chartData: { date: string; current: number | null; compare?: number | null }[];

  if (isHourly) {
    const hourlySales = sales as HourlySales[];
    const currentHour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();

    const salesMap = new Map(hourlySales.map((s) => [Number(s.sale_hour), Number(s.total_sales)]));
    const compareMap = hasCompare
      ? new Map((compareSales as HourlySales[]).map((s) => [Number(s.sale_hour), Number(s.total_sales)]))
      : null;

    const getVal = (h: number, map: Map<number, number>) => h <= currentHour ? (map.get(h) ?? 0) : null;
    chartData = Array.from({ length: 24 }, (_, h) => ({
      date: `${h}시`,
      current: getVal(h, salesMap),
      ...(hasCompare && { compare: getVal(h, compareMap!) }),
    }));
  } else {
    const dailySales = sales as DailySales[];
    const maxLen = Math.max(dailySales.length, compareSales?.length ?? 0);
    chartData = Array.from({ length: maxLen }, (_, i) => {
      const curr = dailySales[i];
      const cmp = (compareSales as DailySales[])?.[i];
      return {
        date: curr ? formatDate(curr.sale_date) : `${i + 1}일`,
        current: curr ? Number(curr.total_sales) : 0,
        ...(hasCompare && { compare: cmp ? Number(cmp.total_sales) : 0 }),
      };
    });
  }

  const salesPct = compareTotalSales !== undefined ? pctChange(totalSales, compareTotalSales) : null;
  const ordersPct = compareTotalOrders !== undefined ? pctChange(totalOrders, compareTotalOrders) : null;
  const buyersPct = compareTotalBuyers !== undefined ? pctChange(totalBuyers, compareTotalBuyers) : null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">매출 현황</h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">총 매출</p>
          <p className="text-xl font-bold text-blue-900">{totalSales.toLocaleString("ko-KR")}원</p>
          {salesPct && (
            <p className={`text-xs mt-1 font-medium ${salesPct.positive ? "text-green-600" : "text-red-500"}`}>
              {salesPct.label}{" "}
              <span className="text-gray-400 font-normal">전기간 대비</span>
            </p>
          )}
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">주문 수</p>
          <p className="text-xl font-bold text-green-900">{totalOrders.toLocaleString("ko-KR")}</p>
          {ordersPct && (
            <p className={`text-xs mt-1 font-medium ${ordersPct.positive ? "text-green-600" : "text-red-500"}`}>
              {ordersPct.label}{" "}
              <span className="text-gray-400 font-normal">전기간 대비</span>
            </p>
          )}
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-600">구매자 수</p>
          <p className="text-xl font-bold text-purple-900">{totalBuyers.toLocaleString("ko-KR")}</p>
          {buyersPct && (
            <p className={`text-xs mt-1 font-medium ${buyersPct.positive ? "text-green-600" : "text-red-500"}`}>
              {buyersPct.label}{" "}
              <span className="text-gray-400 font-normal">전기간 대비</span>
            </p>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barCategoryGap="30%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: isHourly ? 10 : 12, fill: "#9ca3af" }}
              interval={isHourly ? 0 : "preserveStartEnd"}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              formatter={(value, name) => [
                Number(value).toLocaleString("ko-KR") + "원",
                name === "current" ? "현재 기간" : "비교 기간",
              ]}
              labelFormatter={(l) => `${l}`}
            />
            <Legend
              verticalAlign="bottom"
              height={32}
              formatter={(value) => (
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {value === "current" ? "현재 기간" : "비교 기간"}
                </span>
              )}
            />
            {hasCompare && (
              <Bar dataKey="compare" name="compare" fill="#d1d5db" radius={[4, 4, 0, 0]} />
            )}
            <Bar dataKey="current" name="current" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

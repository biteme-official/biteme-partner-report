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
import type { DailySales } from "@/lib/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("ko-KR");
}

function calcDelta(curr: number, prev: number): string | null {
  if (prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

interface Props {
  sales: DailySales[];
  totalSales: number;
  totalOrders: number;
  totalBuyers: number;
  compareSales?: DailySales[];
  compareLabel?: string;
  compareTotalSales?: number;
  compareTotalOrders?: number;
  compareTotalBuyers?: number;
}

export default function SalesOverview({
  sales,
  totalSales,
  totalOrders,
  totalBuyers,
  compareSales,
  compareLabel,
  compareTotalSales,
  compareTotalOrders,
  compareTotalBuyers,
}: Props) {
  const hasCompare = !!compareSales && compareSales.length > 0;
  const maxLen = Math.max(sales.length, compareSales?.length ?? 0);

  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    idx: i,
    date: sales[i] ? formatDate(sales[i].sale_date) : "",
    sales: sales[i] ? Number(sales[i].total_sales) : 0,
    compareDate: compareSales?.[i] ? formatDate(compareSales[i].sale_date) : "",
    compareSales: compareSales?.[i] ? Number(compareSales[i].total_sales) : 0,
  }));

  const salesDelta = hasCompare && compareTotalSales !== undefined
    ? calcDelta(totalSales, compareTotalSales)
    : null;
  const ordersDelta = hasCompare && compareTotalOrders !== undefined
    ? calcDelta(totalOrders, compareTotalOrders)
    : null;
  const buyersDelta = hasCompare && compareTotalBuyers !== undefined
    ? calcDelta(totalBuyers, compareTotalBuyers)
    : null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        매출 현황
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">총 매출</p>
          <p className="text-xl font-bold text-blue-900">
            {formatCurrency(totalSales)}
          </p>
          {salesDelta && (
            <p className={`text-xs mt-1 font-medium ${salesDelta.startsWith("+") ? "text-green-600" : "text-red-500"}`}>
              {salesDelta} vs {compareLabel}
            </p>
          )}
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">주문 수</p>
          <p className="text-xl font-bold text-green-900">
            {totalOrders.toLocaleString("ko-KR")}
          </p>
          {ordersDelta && (
            <p className={`text-xs mt-1 font-medium ${ordersDelta.startsWith("+") ? "text-green-600" : "text-red-500"}`}>
              {ordersDelta} vs {compareLabel}
            </p>
          )}
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-600">구매자 수</p>
          <p className="text-xl font-bold text-purple-900">
            {totalBuyers.toLocaleString("ko-KR")}
          </p>
          {buyersDelta && (
            <p className={`text-xs mt-1 font-medium ${buyersDelta.startsWith("+") ? "text-green-600" : "text-red-500"}`}>
              {buyersDelta} vs {compareLabel}
            </p>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow p-3 text-sm">
                    {item.date && <p className="font-medium text-gray-700 mb-1">{item.date}</p>}
                    {payload.map((p, i) => (
                      <p key={i} style={{ color: p.color }}>
                        {p.name}: {Number(p.value).toLocaleString("ko-KR")}원
                      </p>
                    ))}
                    {hasCompare && item.compareDate && (
                      <p className="text-xs text-gray-400 mt-1">비교: {item.compareDate}</p>
                    )}
                  </div>
                );
              }}
            />
            {hasCompare && <Legend />}
            <Bar dataKey="sales" name="현재 기간" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            {hasCompare && (
              <Bar dataKey="compareSales" name={compareLabel ?? "비교 기간"} fill="#d1d5db" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

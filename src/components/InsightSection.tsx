"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlySales, GrowthProduct, ReturnRate } from "@/lib/types";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("ko-KR");
}

interface Props {
  monthly: MonthlySales[];
  growth: GrowthProduct[];
  returnRate: ReturnRate | null;
  compareMonthly?: MonthlySales[];
  compareLabel?: string;
}

export default function InsightSection({ monthly, growth, returnRate, compareMonthly, compareLabel }: Props) {
  const hasCompare = !!compareMonthly && compareMonthly.length > 0;
  const maxLen = Math.max(monthly.length, compareMonthly?.length ?? 0);

  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    idx: i,
    month: monthly[i]?.month ?? "",
    sales: monthly[i] ? Number(monthly[i].total_sales) : 0,
    compareMonth: compareMonthly?.[i]?.month ?? "",
    compareSales: compareMonthly?.[i] ? Number(compareMonthly[i].total_sales) : 0,
  }));

  const latestMonth = monthly.length >= 2 ? monthly[monthly.length - 1] : null;
  const prevMonth = monthly.length >= 2 ? monthly[monthly.length - 2] : null;
  const momGrowth =
    latestMonth && prevMonth && Number(prevMonth.total_sales) > 0
      ? (
          ((Number(latestMonth.total_sales) - Number(prevMonth.total_sales)) /
            Number(prevMonth.total_sales)) *
          100
        ).toFixed(1)
      : null;

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          월별 매출 추이
        </h2>

        <div className="flex gap-4 mb-4">
          {momGrowth !== null && (
            <div
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                Number(momGrowth) >= 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              MoM {Number(momGrowth) >= 0 ? "+" : ""}
              {momGrowth}%
            </div>
          )}
          {returnRate && (
            <div className="rounded-lg px-4 py-2 text-sm font-medium bg-orange-50 text-orange-700">
              반품률 {returnRate.return_rate ?? 0}%
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
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
                      {item.month && <p className="font-medium text-gray-700 mb-1">{item.month}</p>}
                      {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color }}>
                          {p.name}: {Number(p.value).toLocaleString("ko-KR")}원
                        </p>
                      ))}
                      {hasCompare && item.compareMonth && (
                        <p className="text-xs text-gray-400 mt-1">비교: {item.compareMonth}</p>
                      )}
                    </div>
                  );
                }}
              />
              {hasCompare && <Legend />}
              <Line
                type="monotone"
                dataKey="sales"
                name="현재 기간"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
              />
              {hasCompare && (
                <Line
                  type="monotone"
                  dataKey="compareSales"
                  name={compareLabel ?? "비교 기간"}
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "#9ca3af", r: 3 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {growth.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            성장/하락 상품 (최근 30일 vs 이전 30일)
          </h2>
          <div className="space-y-2">
            {growth.map((g) => (
              <div
                key={g.product_cd}
                className="flex items-start justify-between gap-6 py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-900 break-keep">
                  {g.product_nm}
                </span>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-sm text-gray-500">
                    {formatCurrency(Number(g.curr_sales))}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      g.growth_rate !== null && g.growth_rate >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {g.growth_rate !== null
                      ? `${g.growth_rate >= 0 ? "+" : ""}${g.growth_rate}%`
                      : "NEW"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

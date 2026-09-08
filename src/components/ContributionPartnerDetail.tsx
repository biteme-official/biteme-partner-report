"use client";

import Link from "next/link";
import ContributionFlowChart, { type FlowPoint } from "@/components/ContributionFlowChart";
import { formatNumber, formatRate } from "@/lib/format";
import type { ContributionPartnerRow } from "@/lib/types";

export default function ContributionPartnerDetail({
  partner,
  year,
  currentMonth,
  onClose,
}: {
  partner: ContributionPartnerRow;
  year: number;
  currentMonth: number | null;
  onClose: () => void;
}) {
  const lastMonth = currentMonth ?? 12;

  const points: FlowPoint[] = Array.from({ length: lastMonth }, (_, i) => ({
    key: `${i + 1}`,
    label: `${i + 1}월`,
    contribution: partner.contribution[i] ?? 0,
    sales: partner.sales[i] ?? 0,
    partial: currentMonth !== null && i + 1 >= currentMonth,
  }));

  // 이익률은 진행 중인 달을 빼고 낸다 (시트 공헌이익이 아직 다 차지 않음)
  const closed = points.filter((p) => !p.partial);
  const closedContribution = closed.reduce((s, p) => s + p.contribution, 0);
  const closedSales = closed.reduce((s, p) => s + p.sales, 0);

  return (
    <section className="bg-white rounded-xl border border-blue-200 p-6">
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{partner.partner_name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{year}년 월별 흐름</p>
        </div>
        <div className="ml-auto flex items-center gap-2 no-print">
          {partner.partner_id !== null && (
            <Link
              href={`/partners/${partner.partner_id}`}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              매출 상세 리포트
            </Link>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-violet-50 rounded-lg p-4">
          <p className="text-sm text-violet-600">거래액</p>
          <p className="text-xl font-bold text-violet-900">
            {formatNumber(partner.sales_total)}원
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">공헌이익</p>
          <p className="text-xl font-bold text-blue-900">
            {partner.in_sheet ? `${formatNumber(partner.contribution_total)}원` : "미집계"}
          </p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-4">
          <p className="text-sm text-emerald-600">공헌이익률</p>
          <p className="text-xl font-bold text-emerald-900">
            {partner.in_sheet ? formatRate(closedContribution, closedSales) : "—"}
          </p>
          {closed.length < points.length && (
            <p className="text-xs text-gray-400 mt-1">
              1~{closed.length}월 기준
            </p>
          )}
        </div>
      </div>

      <ContributionFlowChart points={points} />

      <div className="overflow-x-auto mt-6">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-200">
              <th className="py-2 text-left font-normal">월</th>
              {points.map((p) => (
                <th key={p.key} className="py-2 text-right font-normal">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 text-gray-500">거래액</td>
              {points.map((p) => (
                <td key={p.key} className="py-2 text-right text-gray-700 tabular-nums">
                  {formatNumber(p.sales)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 text-gray-500">공헌이익</td>
              {points.map((p) => (
                <td
                  key={p.key}
                  className={`py-2 text-right tabular-nums ${
                    p.contribution < 0 ? "text-red-500" : "text-gray-900"
                  }`}
                >
                  {formatNumber(p.contribution)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 text-gray-500">공헌이익률</td>
              {points.map((p) => (
                <td key={p.key} className="py-2 text-right text-gray-500 tabular-nums">
                  {p.partial ? "—" : formatRate(p.contribution, p.sales)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

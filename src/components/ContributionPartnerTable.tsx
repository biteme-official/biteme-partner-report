"use client";

import { useMemo, useState } from "react";
import { formatNumber, formatRate } from "@/lib/format";

export interface ContributionTableRow {
  partner_id: number | null;
  partner_name: string;
  sales: number;
  contribution: number;
  in_sheet: boolean;
  /** 직전 구간 공헌이익 — 있으면 증감 열을 보여준다 */
  prev_contribution?: number;
  /** 이익률 계산에 쓸 값. 진행 중인 달을 뺀 값이 들어온다 (없으면 위 값 그대로) */
  rate_contribution?: number;
  rate_sales?: number;
}

type SortKey = "contribution" | "sales" | "rate";

const PAGE_STEP = 30;

function rateNumerator(row: ContributionTableRow): number {
  return row.rate_contribution ?? row.contribution;
}

function rateDenominator(row: ContributionTableRow): number {
  return row.rate_sales ?? row.sales;
}

function rateOf(row: ContributionTableRow): number {
  const d = rateDenominator(row);
  return d > 0 ? rateNumerator(row) / d : Number.NEGATIVE_INFINITY;
}

export default function ContributionPartnerTable({
  rows,
  selectedName,
  onSelect,
  showDelta,
  deltaLabel,
  rateNote,
}: {
  rows: ContributionTableRow[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  showDelta?: boolean;
  deltaLabel?: string;
  rateNote?: string;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("contribution");
  const [visible, setVisible] = useState(PAGE_STEP);

  const totalContribution = useMemo(
    () => rows.reduce((sum, r) => sum + Math.max(r.contribution, 0), 0),
    [rows]
  );

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.partner_name.toLowerCase().includes(q))
      : rows;
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "sales") return b.sales - a.sales;
      if (sortKey === "rate") return rateOf(b) - rateOf(a);
      return b.contribution - a.contribution;
    });
    return copy;
  }, [rows, search, sortKey]);

  const shown = sorted.slice(0, visible);

  const headerButton = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        setSortKey(key);
        setVisible(PAGE_STEP);
      }}
      className={`hover:text-gray-700 transition-colors ${
        sortKey === key ? "text-gray-900 font-medium" : ""
      }`}
    >
      {label}
      {sortKey === key && <span className="ml-0.5">↓</span>}
    </button>
  );

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">파트너사별</h2>
        <input
          type="text"
          placeholder="파트너사 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(PAGE_STEP);
          }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent no-print"
        />
        {rateNote && <span className="text-xs text-gray-400">{rateNote}</span>}
        <span className="text-sm text-gray-400 ml-auto">{sorted.length}개 파트너사</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-200">
              <th className="w-10 py-2 text-left font-normal">#</th>
              <th className="py-2 text-left font-normal min-w-[180px]">공급사명</th>
              <th className="py-2 text-right font-normal w-32">
                {headerButton("sales", "거래액")}
              </th>
              <th className="py-2 text-right font-normal w-32">
                {headerButton("contribution", "공헌이익")}
              </th>
              <th className="py-2 text-right font-normal w-24">
                {headerButton("rate", "공헌이익률")}
              </th>
              <th className="py-2 text-right font-normal w-20">비중</th>
              {showDelta && (
                <th className="py-2 text-right font-normal w-28">
                  {deltaLabel ?? "직전 대비"}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((row, i) => {
              const share = totalContribution > 0 ? row.contribution / totalContribution : 0;
              const prev = row.prev_contribution;
              const delta =
                prev === undefined || prev === 0 ? null : (row.contribution - prev) / Math.abs(prev);
              return (
                <tr
                  key={row.partner_name}
                  onClick={() => onSelect(row.partner_name)}
                  className={`cursor-pointer transition-colors ${
                    selectedName === row.partner_name ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                  <td className="py-2 text-gray-900">
                    {row.partner_name}
                    {!row.in_sheet && (
                      <span className="ml-2 text-[11px] text-amber-600">공헌이익 미집계</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-700 tabular-nums">
                    {formatNumber(row.sales)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${
                      row.contribution < 0 ? "text-red-500" : "text-gray-900 font-medium"
                    }`}
                  >
                    {row.in_sheet ? formatNumber(row.contribution) : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-700 tabular-nums">
                    {row.in_sheet ? formatRate(rateNumerator(row), rateDenominator(row)) : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400 tabular-nums">
                    {row.in_sheet && share > 0 ? `${(share * 100).toFixed(1)}%` : "—"}
                  </td>
                  {showDelta && (
                    <td className="py-2 text-right tabular-nums">
                      {delta === null ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span className={delta >= 0 ? "text-green-600" : "text-red-500"}>
                          {delta >= 0 ? "+" : ""}
                          {(delta * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p className="text-center text-gray-400 py-10">표시할 파트너사가 없습니다</p>
      )}

      {visible < sorted.length && (
        <button
          onClick={() => setVisible((v) => v + PAGE_STEP)}
          className="w-full mt-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors no-print"
        >
          더보기 ({sorted.length - visible}개 남음)
        </button>
      )}
    </section>
  );
}

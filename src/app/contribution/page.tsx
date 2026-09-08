"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TabGroup from "@/components/TabGroup";
import ContributionFlowChart, { type FlowPoint } from "@/components/ContributionFlowChart";
import ContributionPartnerTable, {
  type ContributionTableRow,
} from "@/components/ContributionPartnerTable";
import ContributionPartnerDetail from "@/components/ContributionPartnerDetail";
import { formatNumber, formatRate } from "@/lib/format";
import type {
  ContributionWeekResponse,
  ContributionYearResponse,
} from "@/lib/types";

const YEARS = [2025, 2026];

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "violet" | "blue" | "emerald" | "gray";
}) {
  const tones = {
    violet: "bg-violet-50 text-violet-600 text-violet-900",
    blue: "bg-blue-50 text-blue-600 text-blue-900",
    emerald: "bg-emerald-50 text-emerald-600 text-emerald-900",
    gray: "bg-gray-50 text-gray-500 text-gray-900",
  }[tone].split(" ");

  return (
    <div className={`${tones[0]} rounded-lg p-4`}>
      <p className={`text-sm ${tones[1]}`}>{label}</p>
      <p className={`text-xl font-bold ${tones[2]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ContributionPage() {
  const [year, setYear] = useState(YEARS[YEARS.length - 1]);
  const [data, setData] = useState<ContributionYearResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<ContributionWeekResponse | null>(null);
  const [weeksLoading, setWeeksLoading] = useState(false);
  const [weeksError, setWeeksError] = useState<string | null>(null);

  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMonth(null);
    setSelectedPartner(null);
  }, [year]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/contribution?year=${year}`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body as ContributionYearResponse;
      })
      .then((body) => {
        setData(body);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        console.error(e);
        setError(e.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [year]);

  useEffect(() => {
    if (selectedMonth === null) {
      setWeeks(null);
      setWeeksError(null);
      return;
    }
    const controller = new AbortController();
    setWeeksLoading(true);
    setWeeksError(null);
    fetch(`/api/contribution/weeks?year=${year}&month=${selectedMonth}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body as ContributionWeekResponse;
      })
      .then((body) => {
        setWeeks(body);
        setWeeksLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        console.error(e);
        setWeeksError(e.message);
        setWeeksLoading(false);
      });
    return () => controller.abort();
  }, [year, selectedMonth]);

  const lastMonth = data?.meta.current_month ?? 12;

  const monthPoints: FlowPoint[] = useMemo(() => {
    if (!data) return [];
    return data.months
      .filter((m) => m.month <= lastMonth)
      .map((m) => ({
        key: String(m.month),
        label: `${m.month}월`,
        contribution: m.contribution,
        sales: m.sales,
        partial: m.partial,
      }));
  }, [data, lastMonth]);

  const weekPoints: FlowPoint[] = useMemo(() => {
    if (!weeks) return [];
    return weeks.weeks.map((w) => ({
      key: String(w.week_no),
      label: `${w.week_no}주차`,
      sublabel: `${w.start.slice(5).replace("-", "/")}~${w.end.slice(5).replace("-", "/")}`,
      contribution: w.contribution,
      sales: w.sales,
      partial: w.partial,
    }));
  }, [weeks]);

  // 이익률에 쓸 구간 — 진행 중인 달은 시트 공헌이익이 덜 차 있어 뺀다
  const closedMonths = useMemo(
    () => (data ? data.months.filter((m) => !m.partial).map((m) => m.month) : []),
    [data]
  );

  const tableRows: ContributionTableRow[] = useMemo(() => {
    if (!data) return [];
    return data.partners.map((p) => {
      if (selectedMonth === null) {
        let rateContribution = 0;
        let rateSales = 0;
        for (const m of closedMonths) {
          rateContribution += p.contribution[m - 1] ?? 0;
          rateSales += p.sales[m - 1] ?? 0;
        }
        return {
          partner_id: p.partner_id,
          partner_name: p.partner_name,
          sales: p.sales_total,
          contribution: p.contribution_total,
          in_sheet: p.in_sheet,
          rate_contribution: rateContribution,
          rate_sales: rateSales,
        };
      }
      const i = selectedMonth - 1;
      const isPartial = !closedMonths.includes(selectedMonth);
      return {
        partner_id: p.partner_id,
        partner_name: p.partner_name,
        sales: p.sales[i] ?? 0,
        contribution: p.contribution[i] ?? 0,
        in_sheet: p.in_sheet,
        prev_contribution: i > 0 ? p.contribution[i - 1] : undefined,
        rate_contribution: isPartial ? 0 : undefined,
        rate_sales: isPartial ? 0 : undefined,
      };
    });
  }, [data, selectedMonth, closedMonths]);

  const summary = useMemo(() => {
    if (!data) return null;
    const scope =
      selectedMonth === null
        ? data.months.filter((m) => m.month <= lastMonth)
        : data.months.filter((m) => m.month === selectedMonth);
    const contribution = scope.reduce((s, m) => s + m.contribution, 0);
    const sales = scope.reduce((s, m) => s + m.sales, 0);
    const activePartners = tableRows.filter((r) => r.in_sheet && r.contribution !== 0).length;

    // 진행 중인 달은 시트 공헌이익이 덜 채워져 분자만 작다 — 이익률은 완결된 달로만 낸다
    const closed = scope.filter((m) => !m.partial);
    const rateContribution = closed.reduce((s, m) => s + m.contribution, 0);
    const rateSales = closed.reduce((s, m) => s + m.sales, 0);
    const rateNote =
      closed.length === scope.length
        ? undefined
        : closed.length === 0
          ? "진행 중인 달이라 계산하지 않음"
          : `${closed[0].month}~${closed[closed.length - 1].month}월 기준`;

    let prevLabel: string | null = null;
    let prevDelta: number | null = null;
    if (selectedMonth !== null && selectedMonth > 1) {
      const prev = data.months.find((m) => m.month === selectedMonth - 1);
      if (prev && prev.contribution !== 0) {
        prevLabel = `${selectedMonth - 1}월 대비`;
        prevDelta = (contribution - prev.contribution) / Math.abs(prev.contribution);
      }
    }
    return {
      contribution,
      sales,
      activePartners,
      prevLabel,
      prevDelta,
      rateContribution,
      rateSales,
      rateNote,
    };
  }, [data, selectedMonth, lastMonth, tableRows]);

  const selectedPartnerRow = useMemo(
    () => data?.partners.find((p) => p.partner_name === selectedPartner) ?? null,
    [data, selectedPartner]
  );

  const periodLabel = selectedMonth === null ? `${year}년 누적` : `${year}년 ${selectedMonth}월`;

  return (
    <main className="max-w-[1300px] mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">공헌이익</h1>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors no-print"
          >
            ← 파트너 리포트
          </Link>
        </div>
        <p className="text-gray-500 mt-1">
          파트너사별 거래액(운영 DB)과 공헌이익(플랫폼사업부 시트)을 같이 봅니다
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6 no-print">
        <TabGroup<number>
          options={YEARS.map((y) => ({ value: y, label: `${y}년` }))}
          value={year}
          onChange={setYear}
        />
        <TabGroup<number>
          options={[
            { value: 0, label: "연간" },
            ...Array.from({ length: lastMonth }, (_, i) => ({
              value: i + 1,
              label: `${i + 1}월`,
            })),
          ]}
          value={selectedMonth ?? 0}
          onChange={(v) => setSelectedMonth(v === 0 ? null : v)}
          wrapperClassName="flex-wrap"
          buttonClassName="px-2.5 py-1.5 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : error || !data || !summary ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500">공헌이익 데이터를 불러오지 못했습니다</p>
          {error && <p className="text-xs text-gray-400 mt-2">{error}</p>}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{periodLabel}</h2>
              {selectedMonth !== null && (
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 no-print"
                >
                  연간으로 보기
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                tone="violet"
                label="거래액"
                value={`${formatNumber(summary.sales)}원`}
                sub="공헌이익 집계 대상 파트너사"
              />
              <KpiCard
                tone="blue"
                label="공헌이익"
                value={`${formatNumber(summary.contribution)}원`}
                sub={
                  summary.prevDelta !== null
                    ? `${summary.prevDelta >= 0 ? "+" : ""}${(summary.prevDelta * 100).toFixed(1)}% ${summary.prevLabel}`
                    : undefined
                }
              />
              <KpiCard
                tone="emerald"
                label="공헌이익률"
                value={formatRate(summary.rateContribution, summary.rateSales)}
                sub={summary.rateNote}
              />
              <KpiCard
                tone="gray"
                label="파트너사"
                value={`${formatNumber(summary.activePartners)}개`}
                sub={`시트 등재 ${formatNumber(data.meta.sheet_partner_count)}개`}
              />
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">월별 흐름</h2>
              <span className="text-xs text-gray-400">막대를 누르면 그 달로 좁혀 봅니다</span>
            </div>
            <ContributionFlowChart
              points={monthPoints}
              selectedKey={selectedMonth === null ? null : String(selectedMonth)}
              onSelect={(key) => {
                const m = Number(key);
                setSelectedMonth((prev) => (prev === m ? null : m));
              }}
            />
          </section>

          {selectedMonth !== null && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedMonth}월 주차별 흐름
                </h2>
                {weeks?.basis_label && (
                  <span className="text-xs text-gray-400">시트 {weeks.basis_label}</span>
                )}
              </div>

              {weeksLoading ? (
                <div className="flex items-center justify-center py-14">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
                </div>
              ) : weeksError || !weeks ? (
                <p className="text-center text-gray-400 py-10 text-sm">
                  주차별 데이터를 불러오지 못했습니다
                  {weeksError && <span className="block text-xs mt-1">{weeksError}</span>}
                </p>
              ) : (
                <>
                  {weeks.week_count_warning && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2 mb-4">
                      {weeks.week_count_warning}
                    </p>
                  )}
                  <ContributionFlowChart points={weekPoints} />
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b border-gray-200">
                          <th className="py-2 text-left font-normal">주차</th>
                          {weeks.weeks.map((w) => (
                            <th key={w.week_no} className="py-2 text-right font-normal">
                              {w.week_no}주차
                              <span className="block text-[10px] text-gray-300">
                                {w.start.slice(5).replace("-", "/")}~
                                {w.end.slice(5).replace("-", "/")}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr>
                          <td className="py-2 text-gray-500">거래액</td>
                          {weeks.weeks.map((w) => (
                            <td
                              key={w.week_no}
                              className="py-2 text-right text-gray-700 tabular-nums"
                            >
                              {formatNumber(w.sales)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-500">공헌이익</td>
                          {weeks.weeks.map((w) => (
                            <td
                              key={w.week_no}
                              className={`py-2 text-right tabular-nums ${
                                w.contribution < 0 ? "text-red-500" : "text-gray-900"
                              }`}
                            >
                              {formatNumber(w.contribution)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-500">공헌이익률</td>
                          {weeks.weeks.map((w) => (
                            <td
                              key={w.week_no}
                              className="py-2 text-right text-gray-500 tabular-nums"
                            >
                              {w.partial ? "—" : formatRate(w.contribution, w.sales)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          <ContributionPartnerTable
            rows={tableRows}
            selectedName={selectedPartner}
            onSelect={(name) => setSelectedPartner((prev) => (prev === name ? null : name))}
            showDelta={selectedMonth !== null && selectedMonth > 1}
            deltaLabel={selectedMonth !== null ? `${selectedMonth - 1}월 대비` : undefined}
            rateNote={summary.rateNote ? `공헌이익률: ${summary.rateNote}` : undefined}
          />

          {selectedPartnerRow && (
            <ContributionPartnerDetail
              partner={selectedPartnerRow}
              year={year}
              currentMonth={data.meta.current_month}
              onClose={() => setSelectedPartner(null)}
            />
          )}

          <section className="bg-white rounded-xl border border-gray-200 p-5 text-xs text-gray-500 space-y-1.5">
            <p className="text-sm font-medium text-gray-700 mb-2">데이터 안내</p>
            <p>
              · 거래액은 이 리포트의 매출 정의와 같습니다 — 취소·반품 상태, 테스트 계정, 응모권 제외
            </p>
            <p>
              · 공헌이익은 「위탁 파트너사 공헌이익」 시트({year}(TOTAL) 탭)를 공급사명으로 붙였습니다
            </p>
            <p>
              · 시트 공급사 {formatNumber(data.meta.sheet_partner_count)}개 중{" "}
              {formatNumber(data.meta.matched_partner_count)}개가 파트너사와 이름이 맞았습니다
              {data.meta.unmatched_sheet_partners.length > 0 && (
                <span className="text-amber-600">
                  {" "}
                  · 못 맞춘 공급사 {data.meta.unmatched_sheet_partners.length}개:{" "}
                  {data.meta.unmatched_sheet_partners.slice(0, 10).join(", ")}
                  {data.meta.unmatched_sheet_partners.length > 10 && " 외"}
                </span>
              )}
            </p>
            {data.meta.sales_only_partner_count > 0 && (
              <p>
                · 매출은 있으나 시트에 공헌이익 행이 없는 파트너사{" "}
                {formatNumber(data.meta.sales_only_partner_count)}개(거래액{" "}
                {formatNumber(data.meta.sales_only_total)}원)는 상단 합계·비율에서 제외했고 표에는
                「공헌이익 미집계」로 남겨 두었습니다
              </p>
            )}
            <p>· 주차는 월 안에서 잘린 월~일 주 기준입니다 — 표에 실제 날짜 구간을 적었습니다</p>
            {data.meta.current_month !== null && (
              <p>· {data.meta.current_month}월은 아직 진행 중이라 증감 비교에서 제외했습니다</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PartnerCard from "@/components/PartnerCard";
import IntegratedBrandCard from "@/components/IntegratedBrandCard";
import TabGroup from "@/components/TabGroup";
import QuickSearchResults from "@/components/QuickSearchResults";
import type { PartnerSummary, PartnerBasic, BrandBasic, IntegratedBrandSummary } from "@/lib/types";

const PAGE_SIZE = 12;
const MAX_QUICK_MATCHES = 8;

type Tab = "list" | "search" | "integrated";
type SearchMode = "partner" | "brand";
type IntegratedCategory = "all" | "dog" | "cat";
type IntegratedPeriod = "7" | "30" | "90" | "custom";

const INTEGRATED_SUBCATEGORIES: Record<"dog" | "cat", string[]> = {
  dog: ["사료", "간식", "영양제", "의류/스타일", "용품", "장난감"],
  cat: ["사료", "간식", "영양제", "모래", "화장실/위생", "스크래쳐/캣타워", "용품", "장난감", "의류/스타일"],
};

export default function PartnersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("search");
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [searchMode, setSearchMode] = useState<SearchMode>("partner");
  const [quickSearch, setQuickSearch] = useState("");
  const [allPartners, setAllPartners] = useState<PartnerBasic[]>([]);
  const [allPartnersLoading, setAllPartnersLoading] = useState(true);
  const [allPartnersError, setAllPartnersError] = useState(false);
  const [allBrands, setAllBrands] = useState<BrandBasic[]>([]);
  const [allBrandsLoading, setAllBrandsLoading] = useState(false);
  const [allBrandsError, setAllBrandsError] = useState(false);
  const [allBrandsFetched, setAllBrandsFetched] = useState(false);
  const [integratedCategory, setIntegratedCategory] = useState<IntegratedCategory>("all");
  const [integratedSubCategory, setIntegratedSubCategory] = useState<string | null>(null);
  const [integratedPeriod, setIntegratedPeriod] = useState<IntegratedPeriod>("30");
  const [integratedCustomStart, setIntegratedCustomStart] = useState("");
  const [integratedCustomEnd, setIntegratedCustomEnd] = useState("");
  const [integratedBrands, setIntegratedBrands] = useState<IntegratedBrandSummary[]>([]);
  const [integratedLoading, setIntegratedLoading] = useState(true);
  const [integratedError, setIntegratedError] = useState(false);
  const [integratedPage, setIntegratedPage] = useState(1);

  useEffect(() => {
    setIntegratedSubCategory(null);
  }, [integratedCategory]);

  useEffect(() => {
    setIntegratedPage(1);
  }, [integratedCategory, integratedSubCategory, integratedPeriod, integratedCustomStart, integratedCustomEnd]);

  useEffect(() => {
    if (tab !== "integrated") return;

    // 기간설정 모드에서는 시작/종료일을 모두 고를 때까지 조회하지 않는다
    if (integratedPeriod === "custom" && (!integratedCustomStart || !integratedCustomEnd)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const url = new URLSearchParams({
      species: integratedCategory,
      period: integratedPeriod,
    });
    if (integratedSubCategory) url.set("subCategory", integratedSubCategory);
    if (integratedPeriod === "custom") {
      url.set("start", integratedCustomStart);
      url.set("end", integratedCustomEnd);
    }

    setIntegratedLoading(true);
    setIntegratedError(false);
    fetch(`/api/integrated?${url.toString()}`, { signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (signal.aborted) return;
        setIntegratedBrands(data.brands ?? []);
        setIntegratedLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        console.error(e);
        setIntegratedError(true);
        setIntegratedLoading(false);
      });

    return () => controller.abort();
  }, [tab, integratedCategory, integratedSubCategory, integratedPeriod, integratedCustomStart, integratedCustomEnd]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    setLoading(true);
    setError(false);
    fetch(`/api/partners?days=${days}`, { signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (signal.aborted) return;
        setPartners(data.partners ?? []);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        console.error(e);
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [days]);

  useEffect(() => {
    // 매출 유무와 무관하게 전체 파트너사를 찾을 수 있어야 하므로
    // 기간(days) 기반 목록과 별개의 엔드포인트를 사용한다
    fetch("/api/partners/all")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setAllPartners(data.partners ?? []))
      .catch((e) => {
        console.error(e);
        setAllPartnersError(true);
      })
      .finally(() => setAllPartnersLoading(false));
  }, []);

  useEffect(() => {
    // 브랜드 검색 모드로 전환될 때만 불러온다 (파트너 검색만 쓰는 경우 불필요한 호출 방지)
    if (searchMode !== "brand" || allBrandsFetched) return;

    setAllBrandsLoading(true);
    fetch("/api/brands/all")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setAllBrands(data.brands ?? []))
      .catch((e) => {
        console.error(e);
        setAllBrandsError(true);
      })
      .finally(() => {
        setAllBrandsLoading(false);
        setAllBrandsFetched(true);
      });
  }, [searchMode, allBrandsFetched]);

  useEffect(() => {
    setQuickSearch("");
  }, [searchMode]);

  useEffect(() => {
    setPage(1);
  }, [search, days]);

  const filtered = partners.filter((p) =>
    p.partner_name.toLowerCase().includes(search.toLowerCase())
  );

  const salesRankMap = useMemo(() => {
    const map = new Map<number, number>();
    partners.forEach((p, i) => map.set(p.partner_id, i + 1));
    return map;
  }, [partners]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const PAGE_WINDOW = 10;
  const groupStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const groupEnd = Math.min(totalPages, groupStart + PAGE_WINDOW - 1);
  const pageNumbers = Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i);

  const integratedRankMap = useMemo(() => {
    const map = new Map<string, number>();
    integratedBrands.forEach((b, i) => map.set(`${b.partner_id}-${b.brand_cd}`, i + 1));
    return map;
  }, [integratedBrands]);

  const integratedTotalPages = Math.ceil(integratedBrands.length / PAGE_SIZE);
  const integratedPaginated = integratedBrands.slice(
    (integratedPage - 1) * PAGE_SIZE,
    integratedPage * PAGE_SIZE
  );
  const integratedGroupStart = Math.floor((integratedPage - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const integratedGroupEnd = Math.min(integratedTotalPages, integratedGroupStart + PAGE_WINDOW - 1);
  const integratedPageNumbers = Array.from(
    { length: integratedGroupEnd - integratedGroupStart + 1 },
    (_, i) => integratedGroupStart + i
  );

  const quickMatches = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return [];
    return allPartners
      .filter((p) => p.partner_name.toLowerCase().includes(q))
      .slice(0, MAX_QUICK_MATCHES);
  }, [quickSearch, allPartners]);

  const brandQuickMatches = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return [];
    return allBrands
      .filter((b) => b.brand_nm.toLowerCase().includes(q))
      .slice(0, MAX_QUICK_MATCHES);
  }, [quickSearch, allBrands]);

  return (
    <main className="max-w-[1300px] mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Partner Report
        </h1>
        <p className="text-gray-500 mt-1">
          바잇미 파트너사 영업 리포트
        </p>
      </header>

      <div className="flex items-center mb-6 no-print">
        <TabGroup<Tab>
          options={[
            { value: "list", label: "전체 목록" },
            { value: "search", label: "파트너사 검색" },
          ]}
          value={tab}
          onChange={setTab}
          buttonClassName="px-4 py-1.5 text-sm"
          wrapperClassName="w-fit"
        />

        <div className="ml-4 pl-4 border-l border-gray-300">
          <TabGroup<Tab>
            options={[{ value: "integrated", label: "통합" }]}
            value={tab}
            onChange={setTab}
            buttonClassName="px-4 py-1.5 text-sm"
            wrapperClassName="w-fit"
          />
        </div>
      </div>

      {tab === "integrated" ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-2 no-print">
            <TabGroup<IntegratedCategory>
              options={[
                { value: "all", label: "전체" },
                { value: "dog", label: "강아지" },
                { value: "cat", label: "고양이" },
              ]}
              value={integratedCategory}
              onChange={setIntegratedCategory}
            />

            <TabGroup<IntegratedPeriod>
              options={[
                { value: "7", label: "7일" },
                { value: "30", label: "30일" },
                { value: "90", label: "90일" },
                { value: "custom", label: "기간설정" },
              ]}
              value={integratedPeriod}
              onChange={setIntegratedPeriod}
            />

            {integratedPeriod === "custom" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={integratedCustomStart}
                  onChange={(e) => setIntegratedCustomStart(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <span className="text-gray-400 text-sm">~</span>
                <input
                  type="date"
                  value={integratedCustomEnd}
                  onChange={(e) => setIntegratedCustomEnd(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}
          </div>

          {integratedCategory !== "all" && (
            <TabGroup<string>
              options={INTEGRATED_SUBCATEGORIES[integratedCategory].map((sub) => ({
                value: sub,
                label: sub,
              }))}
              value={integratedSubCategory}
              onChange={setIntegratedSubCategory}
              wrapperClassName="flex-wrap mb-6 w-fit no-print"
              buttonClassName="px-2 py-1 text-xs"
            />
          )}

          {integratedLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : integratedError ? (
            <p className="text-center text-gray-400 py-20">
              데이터를 불러올 수 없습니다
            </p>
          ) : integratedBrands.length === 0 ? (
            <p className="text-center text-gray-400 py-20">
              표시할 브랜드가 없습니다
            </p>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {integratedPaginated.map((b) => (
                  <IntegratedBrandCard
                    key={`${b.partner_id}-${b.brand_cd}`}
                    brand={b}
                    salesRank={integratedRankMap.get(`${b.partner_id}-${b.brand_cd}`)}
                  />
                ))}
              </div>

              {integratedTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8 no-print">
                  <button
                    onClick={() => { setIntegratedPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={integratedPage === 1}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    이전
                  </button>
                  {integratedPageNumbers.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setIntegratedPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        integratedPage === p
                          ? "bg-blue-500 text-white border-blue-500 font-medium"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => { setIntegratedPage((p) => Math.min(integratedTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={integratedPage === integratedTotalPages}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : tab === "list" ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6 no-print">
            <input
              type="text"
              placeholder="파트너사 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <TabGroup<number>
              options={[7, 30, 90].map((d) => ({ value: d, label: `${d}일` }))}
              value={days}
              onChange={setDays}
            />
            <span className="text-sm text-gray-400 ml-auto">
              {filtered.length}개 파트너사
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <p className="text-center text-gray-400 py-20">
              데이터를 불러올 수 없습니다
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-20">
              {search ? "검색 결과가 없습니다" : "표시할 파트너사가 없습니다"}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginated.map((p) => (
                  <PartnerCard
                    key={p.partner_id}
                    partner={p}
                    salesRank={salesRankMap.get(p.partner_id)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8 no-print">
                  <button
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    이전
                  </button>
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        page === p
                          ? "bg-blue-500 text-white border-blue-500 font-medium"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="max-w-xl mx-auto py-12 no-print">
          <TabGroup<SearchMode>
            options={[
              { value: "partner", label: "파트너사" },
              { value: "brand", label: "브랜드" },
            ]}
            value={searchMode}
            onChange={setSearchMode}
            wrapperClassName="w-fit mb-4"
          />

          <input
            type="text"
            autoFocus
            placeholder={
              searchMode === "partner"
                ? "파트너사명을 입력하세요..."
                : "브랜드명을 입력하세요..."
            }
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {searchMode === "partner" ? (
            (allPartnersLoading || quickSearch.trim()) && (
              <QuickSearchResults
                loading={allPartnersLoading}
                error={allPartnersError}
                items={quickMatches}
                maxMatches={MAX_QUICK_MATCHES}
                renderItem={(p) => (
                  <button
                    key={p.partner_id}
                    onClick={() => router.push(`/partners/${p.partner_id}`)}
                    className="w-full text-left px-4 py-3 text-sm text-gray-900 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    {p.partner_name}
                  </button>
                )}
              />
            )
          ) : (
            (allBrandsLoading || quickSearch.trim()) && (
              <QuickSearchResults
                loading={allBrandsLoading}
                error={allBrandsError}
                items={brandQuickMatches}
                maxMatches={MAX_QUICK_MATCHES}
                renderItem={(b) => (
                  <button
                    key={`${b.partner_id}-${b.brand_cd}`}
                    onClick={() => router.push(`/partners/${b.partner_id}/brands/${b.brand_cd}`)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-gray-900">{b.brand_nm}</span>
                    <span className="text-gray-400 ml-2 text-xs">{b.partner_name}</span>
                  </button>
                )}
              />
            )
          )}
        </div>
      )}
    </main>
  );
}

// 찜 집계 확인용 화면 (#61) — /api/wishes 를 사람이 읽을 수 있게 표로 보여 준다.
// 하영님 쿼리 결과와 나란히 놓고 대조하려는 임시 화면이라, 확인이 끝나면 머지 전에 뺀다.

import { queryBatch } from "@/lib/db";
import { brandWishSQL, topProductWishSQL } from "@/lib/queries/wishes";
import type { BrandWish, ProductWish } from "@/lib/types";

export const dynamic = "force-dynamic";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const STATE: Record<string, string> = { "0": "준비중", "1": "승인요청", "2": "판매중", "3": "판매중지", "4": "품절" };
const n = (v: unknown) => (Number(v) || 0).toLocaleString("ko-KR");

export default async function WishesCheck({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const start = YMD.test(sp.start ?? "") ? sp.start! : "2026-09-01";
  const end = YMD.test(sp.end ?? "") ? sp.end! : "2026-09-30";

  const [brands, products] = await queryBatch<[BrandWish[], ProductWish[]]>([
    brandWishSQL({ start, end }),
    topProductWishSQL({ start, end }, 5),
  ]);
  const brandRows = [...brands].sort((a, b) => Number(b.total_wish) - Number(a.total_wish));
  const productRows = [...products].sort((a, b) => Number(b.total_wish) - Number(a.total_wish));

  const th = "border-b border-gray-300 px-3 py-2 text-left font-semibold bg-gray-50 sticky top-0";
  const td = "border-b border-gray-100 px-3 py-1.5";
  const num = `${td} text-right tabular-nums`;

  return (
    <main className="mx-auto max-w-6xl p-6 text-sm">
      <h1 className="text-xl font-bold">찜 집계 확인 ({start} ~ {end})</h1>
      <p className="mt-2 text-gray-600">
        기간은 주소 끝을 바꿔 조정합니다: <code>?start={start}&amp;end={end}</code>. 표 안 검색은 Ctrl+F.
      </p>
      <ul className="mt-2 list-disc pl-5 text-gray-600">
        <li><b>기간 찜</b> = 이 기간에 찜해서 지금도 유지 중인 수 · <b>누적 찜</b> = 지금 찜하고 있는 수 (찜 해제 시 행이 지워짐)</li>
        <li>브랜드 표의 누적 찜 ↔ 「찜추가 브랜드 기준」 쿼리의 <code>wish_cnt</code>, 기간 찜 ↔ 같은 쿼리 <code>daily_wish_cnt</code> 를 브랜드별로 더한 값</li>
        <li>상품 표의 누적 찜 ↔ 「상품 찜 상위」 쿼리의 <code>찜수</code> (상품코드로 찾기)</li>
      </ul>

      <h2 className="mt-8 text-lg font-bold">브랜드 찜 — {brandRows.length.toLocaleString("ko-KR")}개 브랜드 (누적 많은 순)</h2>
      <div className="mt-2 max-h-[60vh] overflow-auto rounded border">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>브랜드명</th>
              <th className={th}>브랜드코드</th>
              <th className={`${th} text-right`}>기간 찜</th>
              <th className={`${th} text-right`}>누적 찜</th>
            </tr>
          </thead>
          <tbody>
            {brandRows.map((b) => (
              <tr key={b.brand_cd}>
                <td className={td}>{b.brand_nm}</td>
                <td className={`${td} text-gray-500`}>{b.brand_cd}</td>
                <td className={num}>{n(b.period_wish)}</td>
                <td className={num}>{n(b.total_wish)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-bold">
        상품 찜 — 위탁사별 기간 찜 상위 5개, {productRows.length.toLocaleString("ko-KR")}개 상품 (누적 많은 순)
      </h2>
      <p className="mt-1 text-gray-600">메일에는 이 중 위탁사마다 기간 찜 상위 3개가 들어갑니다.</p>
      <div className="mt-2 max-h-[60vh] overflow-auto rounded border">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>위탁사</th>
              <th className={th}>상품코드</th>
              <th className={th}>상품명</th>
              <th className={th}>판매상태</th>
              <th className={th}>노출</th>
              <th className={`${th} text-right`}>기간 찜</th>
              <th className={`${th} text-right`}>누적 찜</th>
            </tr>
          </thead>
          <tbody>
            {productRows.map((p) => (
              <tr key={p.product_cd}>
                <td className={td}>{p.partner_name}</td>
                <td className={`${td} text-gray-500`}>{p.product_cd}</td>
                <td className={td}>{p.product_nm}</td>
                <td className={td}>{STATE[String(p.product_state)] ?? p.product_state}</td>
                <td className={td}>{String(p.display_yn).toLowerCase() === "y" ? "노출" : "미노출"}</td>
                <td className={num}>{n(p.period_wish)}</td>
                <td className={num}>{n(p.total_wish)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

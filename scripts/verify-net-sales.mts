/**
 * 태블로 실매출 대조용 스크립트 (이슈 #59).
 *   npx tsx scripts/verify-net-sales.mts --env <env파일> [--partner 1502] [--from 2026-09-01] [--to "2026-09-17 11:29:59"]
 * env 파일에는 db.ts 가 쓰는 SSH_HOST·SSH_USER·SSH_KEY_BASE64·DB_HOST·DB_USER·DB_PASSWORD·DB_NAME 이 있어야 한다.
 * 태블로는 매일 11:30 갱신이라 당일과 비교할 땐 --to 를 "당일 11:29:59" 로 줄 것.
 */
import { readFileSync } from "fs";
import { queryBatch } from "../src/lib/db";
import { partnerSalesSQL } from "../src/lib/queries/partners";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const envPath = arg("env");
if (envPath) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const v = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}

const partner = arg("partner", "1502")!;
const from = new Date(`${arg("from", "2026-09-01")}T00:00:00`);
const toArg = arg("to");
const to = toArg ? new Date(toArg.replace(" ", "T")) : new Date();

// 비교용: 기존 화면이 보여 주던 total_price 단순 합
const oldSQL = `
  SELECT DATE(op.reg_date) AS sale_date, ROUND(SUM(op.total_price)) AS old_total
  FROM wt_order_product op
  JOIN wt_order_info oi ON op.ocode = oi.ocode
  JOIN wt_product p ON op.product_cd = p.product_cd
  WHERE p.supplier = ${Number(partner)}
    AND oi.order_yn = 'y'
    AND op.product_order_state_cd NOT IN ('10','50','65','70','95','99')
    AND (oi.user_id IS NULL OR oi.user_id NOT IN ('ptest','ptest2','cafebiteme_SS','cafebiteme_YN','bite1008','cafebiteme_CG'))
    AND op.product_nm NOT LIKE '%응모권%'
    AND op.reg_date BETWEEN '${from.toISOString().slice(0, 10)} 00:00:00' AND '${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")} ${String(to.getHours()).padStart(2, "0")}:${String(to.getMinutes()).padStart(2, "0")}:${String(to.getSeconds()).padStart(2, "0")}'
  GROUP BY DATE(op.reg_date) ORDER BY sale_date`;

interface Row { sale_date: Date | string; total_sales: string; gross_sales: string; coupon: string; reserve: string; deposit: string; trans: string; order_count: number }
interface OldRow { sale_date: Date | string; old_total: string }

const t0 = Date.now();
const [rows, oldRows] = await queryBatch<[Row[], OldRow[]]>([partnerSalesSQL(partner, from, to), oldSQL]);
console.log(`partner ${partner}  ${from.toISOString().slice(0, 10)} ~ ${toArg ?? "now"}  (${Date.now() - t0}ms)`);
const oldMap = new Map(oldRows.map((r) => [String(r.sale_date).slice(0, 10), Number(r.old_total)]));
const sum = { net: 0, gross: 0, coupon: 0, reserve: 0, deposit: 0, trans: 0, old: 0 };
console.log("date        net_sales   gross   coupon reserve deposit  trans | old(total_price)");
for (const r of rows) {
  const d = String(r.sale_date).slice(0, 10);
  const old = oldMap.get(d) ?? 0;
  console.log(`${d}  ${Number(r.total_sales).toLocaleString().padStart(10)} ${Number(r.gross_sales).toLocaleString().padStart(9)} ${Number(r.coupon).toLocaleString().padStart(8)} ${Number(r.reserve).toLocaleString().padStart(7)} ${Number(r.deposit).toLocaleString().padStart(7)} ${Number(r.trans).toLocaleString().padStart(6)} | ${old.toLocaleString()}`);
  sum.net += Number(r.total_sales); sum.gross += Number(r.gross_sales); sum.coupon += Number(r.coupon);
  sum.reserve += Number(r.reserve); sum.deposit += Number(r.deposit); sum.trans += Number(r.trans); sum.old += old;
}
console.log("----");
console.log(`실매출 ${sum.net.toLocaleString()} = 매출액 ${sum.gross.toLocaleString()} (배송비 ${sum.trans.toLocaleString()} 포함) − 쿠폰 ${sum.coupon.toLocaleString()} − 적립금 ${sum.reserve.toLocaleString()} − 예치금 ${sum.deposit.toLocaleString()}`);
console.log(`기존 total_price 합 ${sum.old.toLocaleString()}`);

import { NextRequest, NextResponse } from "next/server";
import { OWN_SCOPE_ID, parsePartnerScope, type PartnerScope } from "@/lib/queries/partnerScope";

/**
 * 위탁사 상세 경로의 id 를 범위로 바꿉니다 (#83).
 *
 * id 가 0(바잇미 자체)이면 `/api/promo-groups` 처럼 `Authorization: Bearer $PROMO_GROUPS_TOKEN` 이 있어야 답합니다 —
 * 공개 주소라 누구나 부를 수 있는데, 자체 매출은 다른 API 들이 일부러 빼 온 숫자이기 때문입니다.
 * 토큰이 설정돼 있지 않으면 닫습니다. 위탁사 번호는 지금까지처럼 그대로 통과합니다.
 */
export function ownScopeGuard(req: NextRequest, id: string): PartnerScope | NextResponse {
  if (id !== OWN_SCOPE_ID) return id;
  const token = process.env.PROMO_GROUPS_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scope = parsePartnerScope(id, req.nextUrl.searchParams);
  if (typeof scope === "string") return NextResponse.json({ error: scope }, { status: 400 });
  return scope;
}

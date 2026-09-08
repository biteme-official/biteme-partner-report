// 공헌이익 화면은 시트 읽기 + 연간 매출 집계라 한 번 조회가 무겁다.
// 인스턴스 메모리에 짧게 담아 같은 조건 재조회를 막는다.
const store = new Map<string, { value: unknown; expiresAt: number }>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

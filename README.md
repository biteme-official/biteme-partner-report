# BITEME Partner Report

바잇미 파트너사 영업 미팅용 리포트 대시보드

**Production:** https://biteme-partner-report.vercel.app

---

## 전체 흐름

```
팀원 A ── feature/a ──→ PR ──→ Preview URL ──┐
팀원 B ── feature/b ──→ PR ──→ Preview URL ──┼── 운영자가 리뷰 → 머지 → Production
팀원 C ── feature/c ──→ PR ──→ Preview URL ──┘
```

- 각자 브랜치에서 작업하고 PR로만 master에 합침
- **운영자가 머지하기 전까지 Production에는 아무 영향 없음**
- 로컬에서는 DB 접속이 안 되므로, PR의 **Vercel Preview URL**로 실데이터 확인

---

## 팀원 가이드 (개발자)

### 1. 최초 1회: 클론 & 설치

```bash
git clone https://github.com/biteme-official/biteme-partner-report.git
cd biteme-partner-report
npm install
```

### 2. 작업 시작 (매번)

```bash
git checkout master
git pull origin master              # 항상 최신 코드 기준으로
git checkout -b feature/작업내용     # 브랜치 생성
```

브랜치 이름 예시: `feature/add-category-chart`, `fix/product-table-sort`

### 3. 로컬 개발

```bash
npm run dev
```

UI/레이아웃 확인은 로컬에서 가능. 단, DB 연결이 안 되므로 데이터는 보이지 않음.

### 4. 커밋 & 푸시

```bash
git add .
git commit -m "변경 내용 요약"
git push origin feature/작업내용
```

### 5. PR 생성 & 실데이터 확인

- GitHub에서 PR 생성
- PR 본문: 어떤 섹션을 추가/수정했는지 간단히 기재
- **Reviewer: @bmahsang 지정**
- PR 페이지 하단에 Vercel bot이 **Preview URL** 댓글을 달아줌 → 클릭하면 실데이터로 확인 가능

### 6. 수정이 필요하면

리뷰 코멘트를 받았거나, Preview에서 문제를 발견하면:

```bash
# 같은 브랜치에서 수정 계속
git add .
git commit -m "수정 내용"
git push origin feature/작업내용
```

Preview URL이 자동으로 업데이트됨. 새로 PR을 만들 필요 없음.

### 7. 리뷰 통과 → 머지

운영자가 Approve → Merge 하면 Production에 자동 반영. 끝.

### 주의사항

- `master`에 직접 push 금지 — 반드시 PR로 진행 (브랜치 보호 걸려있음)
- `.env.local` 파일은 커밋하지 마세요 (DB 비밀번호 포함)
- 새 패키지 설치 시 `package.json` 변경사항도 함께 커밋

---

## 운영자 가이드 (@bmahsang)

### PR 리뷰 & 머지

1. PR 도착 → GitHub에서 코드 변경사항 확인
2. Preview URL로 실데이터 동작 확인
3. 판단:
   - OK → **Approve → Merge** → Production 자동 반영
   - 수정 필요 → PR에 코멘트 → 팀원이 수정 후 재푸시
   - 충돌 발생 → 팀원에게 최신 master 반영 요청 (`git pull origin master` → 충돌 해결 → 재푸시)

---

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                         # 파트너사 목록 (검색, 기간 필터)
│   ├── partners/[id]/page.tsx           # 파트너사 상세 리포트
│   └── api/
│       └── partners/
│           ├── route.ts                 # 파트너 목록 API
│           └── [id]/
│               ├── route.ts             # 파트너 상세 API
│               └── insights/route.ts    # 인사이트 API
├── components/
│   ├── PartnerCard.tsx                  # 목록 카드
│   ├── SalesOverview.tsx                # 매출 현황 차트
│   ├── ProductMix.tsx                   # 상품 성과 테이블
│   ├── BuyerAnalysis.tsx                # 신규/재구매 분석
│   └── InsightSection.tsx               # 월별 추이, 성장상품, 반품률
└── lib/
    ├── db.ts                            # SSH 터널 + MySQL 연결
    ├── types.ts                         # TypeScript 타입 정의
    └── queries/
        ├── partners.ts                  # 파트너 목록/상세/매출/상품 쿼리
        └── insights.ts                  # 추이/성장/반품/신규재구매 쿼리
```

## 리포트 섹션 (파트너 상세 페이지)

| 섹션 | 설명 | 컴포넌트 |
|------|------|----------|
| 기본 정보 | 입점일, 브랜드수, 활성 상품수 | page.tsx |
| 취급 브랜드 | 브랜드 태그 리스트 | page.tsx |
| 매출 현황 | KPI 카드 + 일별 바차트 | SalesOverview |
| 상품 성과 | Top 20 상품 테이블 | ProductMix |
| 신규/재구매 | 요약 카드 + 월별 스택 차트 | BuyerAnalysis |
| 월별 추이 | 6개월 라인차트, MoM, 반품률 | InsightSection |
| 성장/하락 상품 | 최근 30일 vs 이전 30일 | InsightSection |

## 기술 스택

- **Next.js 16** + React 19 + TypeScript
- **Tailwind CSS 4**
- **Recharts** (차트)
- **ssh2 + mysql2** (SSH 터널 경유 RDS 접속)
- **Vercel** (배포)

## 새 섹션/API 추가하기

1. `src/lib/queries/`에 SQL 쿼리 함수 추가
2. `src/lib/types.ts`에 타입 정의
3. `src/app/api/partners/[id]/`에 API 라우트 추가
4. `src/components/`에 UI 컴포넌트 추가
5. `src/app/partners/[id]/page.tsx`에서 컴포넌트 연결

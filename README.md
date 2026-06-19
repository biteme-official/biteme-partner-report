# BITEME Partner Report

바잇미 파트너사 영업 미팅용 리포트 대시보드

**Production:** https://biteme-partner-report.vercel.app

---

## 개발 워크플로우

로컬에서는 DB 접속이 안 되므로, **Vercel Preview 배포**로 실데이터를 확인합니다.
`master` 직접 푸시는 하지 말고, 반드시 **브랜치 → PR → 리뷰 → 머지** 순서로 진행합니다.

```
브랜치 생성 → 코드 수정 → 푸시 → PR 생성 → Preview URL로 확인 → 리뷰 요청 → 승인 후 머지 → Production 반영
```

### 1. 최초 1회: 클론 & 설치

```bash
git clone https://github.com/biteme-official/biteme-partner-report.git
cd biteme-partner-report
npm install
```

### 2. 작업 시작: 브랜치 생성

```bash
git checkout master
git pull origin master
git checkout -b feature/작업내용
```

브랜치 이름 예시: `feature/add-category-chart`, `fix/product-table-sort`

### 3. 로컬 개발

```bash
npm run dev
```

UI/레이아웃 작업은 로컬에서 확인 가능합니다. 단, DB 연결이 안 되므로 데이터는 보이지 않습니다.

### 4. 커밋 & 푸시

```bash
git add .
git commit -m "변경 내용 요약"
git push origin feature/작업내용
```

### 5. PR 생성 & 실데이터 확인

GitHub에서 PR을 생성하면 Vercel이 자동으로 **Preview URL**을 만들어줍니다.
PR 페이지 하단 Vercel bot 댓글에서 Preview URL을 클릭하면 실데이터로 확인 가능합니다.

- PR 제목: 변경 내용 요약
- PR 본문: 어떤 섹션을 추가/수정했는지 간단히 기재
- Reviewer: @bmahsang 지정

### 6. 머지 → 프로덕션 배포

리뷰어가 PR을 승인하고 머지하면 https://biteme-partner-report.vercel.app 에 자동 반영됩니다.

### 주의사항

- `master`에 직접 push 금지 — 반드시 PR로 진행
- `.env.local` 파일은 커밋하지 마세요 (DB 비밀번호 포함)
- 새 패키지 설치 시 `package.json` 변경사항도 함께 커밋

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

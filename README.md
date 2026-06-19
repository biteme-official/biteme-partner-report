# BITEME Partner Report

바잇미 파트너사 영업 미팅용 리포트 대시보드

**Production:** https://biteme-partner-report.vercel.app

---

## 개발 워크플로우

로컬에서는 DB 접속이 안 되므로, **Vercel Preview 배포**로 실데이터를 확인합니다.

```
코드 수정 → 브랜치 푸시 → PR 생성 → Vercel Preview URL로 확인 → 머지 → Production 자동 반영
```

### 1. 클론 & 설치

```bash
git clone https://github.com/biteme-official/biteme-partner-report.git
cd biteme-partner-report
npm install
```

### 2. 로컬 개발 서버

```bash
npm run dev
```

UI/레이아웃 작업은 로컬에서 가능합니다. 단, API 호출은 실패하므로 데이터는 보이지 않습니다.

### 3. 실데이터 확인 (Preview 배포)

```bash
git checkout -b feature/내-작업
# 코드 수정
git add .
git commit -m "변경 내용"
git push origin feature/내-작업
```

GitHub에서 PR을 생성하면 Vercel이 자동으로 Preview URL을 만들어줍니다.
PR 페이지 하단 Vercel bot 댓글에서 URL을 확인하세요.

### 4. 머지 → 프로덕션 배포

PR이 `master`에 머지되면 https://biteme-partner-report.vercel.app 에 자동 반영됩니다.

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

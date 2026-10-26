/**
 * 카테고리 매출(이슈 #75)의 대상 대분류 — wt_product_category.category1_cd (6자리).
 * 순서는 쇼핑몰 메뉴 순서입니다. 이름은 응답의 categories(wt_category)에서 다시 읽지만,
 * 메뉴에서 쓰는 짧은 이름을 기준으로 둡니다.
 *
 * 이벤트 카테고리(031024 추석세일 등)·브랜드관(100000 ONLY바잇미, 40 바잇미x콜라보 등)은 넣지 않습니다 —
 * 대표 카테고리가 그쪽인 상품은 아래 대상 대분류 연결을 찾아 배정하고, 없으면 미지정입니다.
 */

export type CategorySpecies = "dog" | "cat";

export interface CategoryMajor {
  cd: string;
  name: string;
  species: CategorySpecies;
}

export const CATEGORY_MAJORS: CategoryMajor[] = [
  { cd: "031001", name: "사료", species: "dog" },
  { cd: "031002", name: "간식", species: "dog" },
  { cd: "031009", name: "영양제", species: "dog" },
  { cd: "031003", name: "의류/스타일", species: "dog" },
  { cd: "031004", name: "용품", species: "dog" },
  { cd: "031005", name: "장난감", species: "dog" },
  { cd: "031006", name: "바잇미 컬처", species: "dog" },
  { cd: "017001", name: "사료", species: "cat" },
  { cd: "017003", name: "간식", species: "cat" },
  { cd: "017014", name: "영양제", species: "cat" },
  { cd: "017012", name: "모래", species: "cat" },
  { cd: "017015", name: "화장실/위생", species: "cat" },
  { cd: "017016", name: "스크래쳐/캣타워", species: "cat" },
  { cd: "017011", name: "용품", species: "cat" },
  { cd: "017006", name: "장난감", species: "cat" },
  { cd: "017005", name: "의류/스타일", species: "cat" },
];

/** 상품 pet_type → 먼저 볼 반려동물 (000 공용은 없음) */
export const PET_TYPE_SPECIES: Record<string, CategorySpecies> = { "001": "dog", "002": "cat" };

export const majorCodes = (species?: CategorySpecies) =>
  CATEGORY_MAJORS.filter((m) => !species || m.species === species).map((m) => m.cd);

// 單一戶別，欄位對應後端 Unit 回應
export type Unit = {
  id: number;
  building_id: number;
  floor: string; // 樓層是文字，例如 3F、B1
  unit_number: string; // 戶號是文字，例如 301、3A
  label: string;
  created_at: string;
  updated_at: string;
};

// 後端回傳的分頁資料
export type UnitPage = {
  items: Unit[];
  total: number;
  page: number;
  page_size: number;
};

// 成功回傳列表；登入失效回傳 null
export async function getUnits(
  buildingId: number,
  page = 1,
): Promise<UnitPage | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(
    `${apiUrl}/api/buildings/${buildingId}/units?page=${page}&page_size=20`,
    {
      method: "GET",
      credentials: "include", // 攜帶登入 Cookie
      cache: "no-store", // 每次向後端取得最新資料
    },
  );

  if (response.status === 401) {
    return null; // 交給頁面導向登入
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    // 優先顯示後端的中文提示，例如沒有此大樓的管理權
    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "無法載入戶別列表，請稍後再試。",
    );
  }

  return response.json();
}

// 新增戶別只需要樓層與戶號；所屬大樓由網址指定
export type CreateUnitInput = {
  floor: string;
  unit_number: string;
};

// 保留 HTTP 狀態碼，讓畫面區分權限不足與一般錯誤
export class UnitApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "UnitApiError";
  }
}

// 修改只允許樓層與戶號，不包含所屬大樓
export type UpdateUnitInput = {
  floor: string;
  unit_number: string;
};

// 成功回傳修改後的戶別；登入失效回傳 null
export async function updateUnit(
  unitId: number,
  data: UpdateUnitInput,
): Promise<Unit | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl === undefined) throw new Error("系統連線設定不完整。");

  const response = await fetch(`${apiUrl}/api/units/${unitId}`, {
    method: "PATCH",
    credentials: "include", // 攜帶登入 Cookie，由後端檢查管理權限
    headers: { "Content-Type": "application/json" },
    // 明確只傳這兩個欄位，不能透過表單更換所屬大樓
    body: JSON.stringify({
      floor: data.floor.trim(),
      unit_number: data.unit_number.trim(),
    }),
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new UnitApiError(
      response.status,
      response.status === 409
        ? "此大樓已有相同戶號，請使用其他戶號。"
        : typeof errorBody?.message === "string"
          ? errorBody.message
          : "修改戶別失敗，請稍後再試。",
    );
  }
  return response.json();
}

// 成功回傳新戶別；登入失效回傳 null
export async function createUnit(
  buildingId: number,
  data: CreateUnitInput,
): Promise<Unit | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl === undefined) throw new Error("系統連線設定不完整。");

  const response = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
    method: "POST",
    credentials: "include", // 攜帶登入 Cookie
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      floor: data.floor.trim(),
      unit_number: data.unit_number.trim(),
    }),
  });

  if (response.status === 401) return null;

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new UnitApiError(
      response.status,
      response.status === 409
        ? "此大樓已有相同戶號，請使用其他戶號。"
        : typeof errorBody?.message === "string"
          ? errorBody.message
          : "新增戶別失敗，請稍後再試。",
    );
  }

  return response.json();
}

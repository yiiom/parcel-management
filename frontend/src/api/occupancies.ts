// 入住資料，欄位對應後端 Occupancy 回應
export type Occupancy = {
  id: number;
  unit_id: number;
  started_at: string;
  ended_at: string | null; // null 代表這次入住尚未結束
  created_at: string;
};

// 入住紀錄的分頁回應
export type OccupancyPage = {
  items: Occupancy[];
  total: number;
  page: number;
  page_size: number;
};

// 成功回傳列表；登入失效回傳 null
export async function getOccupancies(
  unitId: number,
  page = 1,
): Promise<OccupancyPage | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl === undefined) throw new Error("系統連線設定不完整。");

  const response = await fetch(
    `${apiUrl}/api/units/${unitId}/occupancies?page=${page}&page_size=20`,
    {
      method: "GET",
      credentials: "include", // 攜帶登入 Cookie，由後端檢查管理權限
      cache: "no-store", // 取得最新的入住狀態
    },
  );

  if (response.status === 401) return null;

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "無法載入入住紀錄，請稍後再試。",
    );
  }

  return response.json();
}

// 保留 HTTP 狀態碼，讓頁面區分重複入住與權限錯誤
export class OccupancyApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "OccupancyApiError";
  }
}

// 建立目前戶別的入住；登入失效時回傳 null
export async function createOccupancy(unitId: number): Promise<Occupancy | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl === undefined) throw new Error("系統連線設定不完整。");

  const response = await fetch(`${apiUrl}/api/units/${unitId}/occupancies`, {
    method: "POST",
    credentials: "include", // 攜帶登入 Cookie，交由後端檢查權限
    // 此 API 不接受請求內容，不傳 body 或空的 JSON
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new OccupancyApiError(
      response.status,
      response.status === 409
        ? "此戶已有有效入住，不能重複建立。"
        : typeof errorBody?.message === "string"
          ? errorBody.message
          : "建立入住失敗，請稍後再試。",
    );
  }
  return response.json();
}

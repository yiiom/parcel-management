// 一棟大樓的資料
export type Building = {
  can_delete: boolean;
  id: number;
  name: string;
  address: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

// 後端回傳的分頁格式
export type BuildingPage = {
  items: Building[];
  total: number;
  page: number;
  page_size: number;
};

// 登入失效回傳 null；其他錯誤交給畫面處理
export async function getBuildings(
  page = 1,
): Promise<BuildingPage | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(
    `${apiUrl}/api/buildings?page=${page}&page_size=20`,
    {
      method: "GET",
      credentials: "include", // 攜帶登入 Cookie
      cache: "no-store", // 每次讀取最新資料
    },
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "無法載入大樓列表，請稍後再試。",
    );
  }

  return response.json();
}
// 新增大樓需要的資料
export type CreateBuildingInput = {
  name: string;
  address: string;
  phone: string; // 表單沒填電話時，會是空字串
};

// 成功回傳新大樓；登入失效回傳 null
export async function createBuilding(
  data: CreateBuildingInput,
): Promise<Building | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(`${apiUrl}/api/buildings`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone.trim() || null,
    }),
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "新增大樓失敗，請稍後再試。",
    );
  }

  return response.json();
}
// 成功回傳單棟大樓；登入失效回傳 null
export async function getBuilding(
  buildingId: number,
): Promise<Building | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(
    `${apiUrl}/api/buildings/${buildingId}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    },
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "無法載入大樓資料，請稍後再試。",
    );
  }

  return response.json();
}
// 修改表單會送出名稱、地址與電話三個欄位
export type UpdateBuildingInput = {
  name: string;
  address: string;
  phone: string;
};

// 成功回傳更新後的大樓；登入失效回傳 null
export async function updateBuilding(
  buildingId: number,
  data: UpdateBuildingInput,
): Promise<Building | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(
    `${apiUrl}/api/buildings/${buildingId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: data.name.trim(),
        address: data.address.trim(),
        phone: data.phone.trim() || null,
      }),
    },
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "修改大樓資料失敗，請稍後再試。",
    );
  }

  return response.json();
}
// 成功為 true；登入失效為 null。204 不讀 JSON。
export async function deleteBuilding(buildingId: number): Promise<true | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl === undefined) throw new Error("系統連線設定不完整。");
  const response = await fetch(`${apiUrl}/api/buildings/${buildingId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.message === "string" ? body.message : "刪除失敗，請重新查詢大樓狀態。");
  }
  return true;
}

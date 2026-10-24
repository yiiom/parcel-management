import type { CurrentUser } from "@/api/auth"; // 沿用既有帳號資料型別

// 管理員列表中的一筆資料
export type AdminDirectoryEntry = {
  user_id: number;
  name: string;
  building_id: number | null;
  building_name: string | null;
};

// 管理員列表的分頁格式
export type AdminDirectoryPage = {
  items: AdminDirectoryEntry[];
  total: number;
  page: number;
  page_size: number;
};

// 登入失效回傳 null；其他錯誤交給畫面處理
export async function getBuildingAdmins(
  page = 1,
): Promise<AdminDirectoryPage | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(
    `${apiUrl}/api/building-admins?page=${page}&page_size=20`,
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
        : "無法載入管理員列表，請稍後再試。",
    );
  }

  return response.json();
}

// 建立管理員需要的帳號資料
export type CreateBuildingAdminInput = {
  name: string; // 管理員姓名
  email: string; // 登入 Email，不能與既有帳號重複
  phone: string; // 管理員聯絡電話，必填
  password: string; // 登入密碼
};

// 後端成功建立帳號並分配大樓後，回傳的資料
export type BuildingAdmin = {
  id: number; // 大樓分配紀錄的 ID，不是帳號 ID
  building_id: number; // 管理員負責的大樓 ID
  user: CurrentUser; // 帳號資料，包含 user.id，不含密碼
  created_at: string; // 分配紀錄建立時間
};

// 成功回傳分配結果；登入失效回傳 null；其他錯誤拋給畫面處理
export async function createBuildingAdmin(
  buildingId: number, // 表單選擇的大樓 ID
  data: CreateBuildingAdminInput, // 表單輸入的帳號資料
): Promise<BuildingAdmin | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL; // 讀取後端網址

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  // 大樓 ID 放在網址中，帳號資料放在請求內容中
  const response = await fetch(
    `${apiUrl}/api/buildings/${buildingId}/admins`,
    {
      method: "POST", // 建立管理員帳號並分配大樓
      credentials: "include", // 攜帶目前登入的 Cookie
      headers: {
        "Content-Type": "application/json", // 告知後端使用 JSON 格式
      },
      body: JSON.stringify({
        name: data.name.trim(), // 去除姓名頭尾空白
        email: data.email.trim(), // 去除 Email 頭尾空白
        phone: data.phone.trim(), // 去除電話頭尾空白
        password: data.password, // 密碼保持原樣，不自行刪除空白
      }),
    },
  );

  if (response.status === 401) {
    return null; // 交給頁面處理重新登入
  }

  if (!response.ok) {
    // 若回應不是 JSON，使用 null，避免解析錯誤蓋掉原本問題
    const errorBody = await response.json().catch(() => null);

    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message // 優先顯示後端訊息，例如 Email 已註冊
        : "建立管理員失敗，請稍後再試。", // 備用錯誤提示
    );
  }

  return response.json(); // 回傳建立成功的帳號及大樓分配資料
}

// 取消管理員的大樓分配。
// 成功回傳 true；登入失效回傳 null；其他錯誤交給畫面顯示。
export async function unassignBuildingAdmin(
  buildingId: number, // 目前負責的大樓 ID
  userId: number, // 管理員帳號 ID，使用列表中的 user_id
): Promise<true | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  let response: Response;

  try {
    response = await fetch(
      `${apiUrl}/api/buildings/${buildingId}/admins/${userId}`,
      {
        method: "DELETE", // 解除分配關係，不刪除管理員帳號
        credentials: "include", // 攜帶登入 Cookie，由後端檢查權限
        // 這支 API 不需要請求內容，因此不設定 body
      },
    );
  } catch (err) {
    // fetch 連線失敗時，將瀏覽器的英文錯誤轉成中文
    if (err instanceof TypeError) {
      throw new Error("無法連線，請確認網路後再試。");
    }

    throw err; // 其他非預期錯誤保留給畫面處理
  }

  if (response.status === 401) {
    return null; // 讓頁面導向登入頁
  }

  if (!response.ok) {
    // 錯誤回應不一定是 JSON，因此提供解析失敗的備用處理
    const errorBody = await response.json().catch(() => null);

    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message // 例如沒有權限或分配紀錄不存在
        : "取消管理員分配失敗，請稍後再試。",
    );
  }

  // 後端成功回傳 204，沒有 JSON 內容，不能呼叫 response.json()
  return true;
}

// 將既有管理員分配到指定大樓。
// 成功回傳分配資料；登入失效回傳 null；其他錯誤交給畫面顯示。
export async function assignExistingBuildingAdmin(
  buildingId: number, // 使用者在選單選擇的大樓 ID
  userId: number, // 管理員列表中的 user_id，不是分配紀錄 ID
): Promise<BuildingAdmin | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  let response: Response;

  try {
    response = await fetch(
      `${apiUrl}/api/buildings/${buildingId}/admins`,
      {
        method: "POST", // 建立這個帳號與大樓之間的分配關係
        credentials: "include", // 攜帶登入 Cookie，由後端確認操作權限
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId, // 使用既有帳號，不重新建立管理員
        }),
      },
    );
  } catch (err) {
    // 將 fetch 連線失敗轉成中文提示
    if (err instanceof TypeError) {
      throw new Error("無法連線，請確認網路後再試。");
    }

    throw err; // 其他非預期錯誤交給畫面處理
  }

  if (response.status === 401) {
    return null; // 讓頁面清除資料並導向登入頁
  }

  if (!response.ok) {
    // 回應不一定是 JSON，解析失敗時改用備用錯誤訊息
    const errorBody = await response.json().catch(() => null);

    throw new Error(
      typeof errorBody?.message === "string"
        ? errorBody.message // 例如沒有權限，或管理員已有大樓分配
        : "分配大樓失敗，請稍後再試。",
    );
  }

  // 後端會檢查一人一棟規則；此函式不會自動解除原分配
  return response.json(); // 回傳 BuildingAdmin 格式的分配結果
}

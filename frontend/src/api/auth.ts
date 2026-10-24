// 定義註冊時必須提供的四個欄位
export type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

// async 表示這個函式需要等待網路請求完成
export async function registerResident(data: RegisterInput): Promise<void> {
  // 讀取 Docker 設定的後端網址
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  // 將表單資料送到剛才測試過的註冊 API
  const response = await fetch(`${apiUrl}/api/auth/register`, {
    method: "POST", // 使用 POST 新增帳號
    headers: {
      "Content-Type": "application/json", // 告訴後端資料格式是 JSON
    },
    body: JSON.stringify(data), // 將 JavaScript 物件轉成 JSON 字串
  });

  // fetch 收到 409、422、500 時不會自動拋出錯誤，需要自己檢查
  if (!response.ok) {
    // 嘗試讀取後端錯誤內容；若不是 JSON，就使用 null
    const errorBody = await response.json().catch(() => null);

    const message =
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "註冊失敗，請稍後再試。";

    throw new Error(message); // 交給呼叫這個函式的頁面顯示
  }

  // 成功時正常結束；註冊後仍須另外登入
}

// 登入只需要 Email 與密碼
export type LoginInput = {
  email: string;
  password: string;
};

// 呼叫登入 API，成功後由瀏覽器保存 Cookie
export async function loginUser(data: LoginInput): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    credentials: "include", // 允許跨來源請求攜帶 Cookie，並接收登入 Cookie
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data), // 將帳密轉成 JSON 傳給後端
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    const message =
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "登入失敗，請稍後再試。";

    throw new Error(message); // 交給登入頁顯示錯誤
  }
}
// 目前畫面需要使用的帳號欄位
// 對應後端 User 回應格式
export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: "system_admin" | "building_admin" | "resident";
  is_active: boolean;
  created_at: string; // JSON 中的日期是字串
  updated_at: string;
};

// 有效登入回傳帳號；未登入或登入失效回傳 null
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(`${apiUrl}/api/users/me`, {
    method: "GET",
    credentials: "include", // 讓瀏覽器帶上登入 Cookie
    cache: "no-store", // 每次向後端查詢，不使用快取結果
  });

  if (response.status === 401) {
    return null; // 沒有有效登入，讓頁面顯示登入表單
  }

  if (!response.ok) {
    // 伺服器出錯不能直接當成「未登入」
    throw new Error("無法確認登入狀態，請稍後再試。");
  }

  const result = await response.json(); // 讀取後端回傳的 JSON
  return result.user; // 回傳其中的帳號資料
}

// 呼叫後端撤銷目前的登入，並由瀏覽器接收清除 Cookie 的指令
export async function logoutUser(): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(`${apiUrl}/api/auth/logout`, {
    method: "POST",
    credentials: "include", // 帶上 Cookie，讓後端知道要撤銷哪一筆登入
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    const message =
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "登出失敗，請稍後再試。";

    throw new Error(message);
  }

  // 成功回傳 204，沒有內容，因此不用呼叫 response.json()
}

// 允許部分修改；至少提供一個欄位由後端驗證
export type ProfileUpdateInput = {
  name?: string;
  phone?: string;
};

// 成功回傳更新後的帳號；登入失效回傳 null
export async function updateMyProfile(
  data: ProfileUpdateInput,
): Promise<CurrentUser | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(`${apiUrl}/api/users/me`, {
    method: "PATCH",
    credentials: "include", // 帶上登入 Cookie，由後端辨識本人
    headers: {
      "Content-Type": "application/json",
    },
    // 明確只傳姓名與電話；undefined 欄位不會寫入 JSON
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
    }),
  });

  if (response.status === 401) {
    return null; // 讓頁面處理需要重新登入的情況
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    const message =
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "修改失敗，請稍後再試。";

    throw new Error(message);
  }

  // PATCH 直接回傳 User，不需要再取 result.user
  return response.json();
}
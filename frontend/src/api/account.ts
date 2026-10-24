import type { CurrentUser } from "@/api/auth";

// 只列出目前介面會使用的欄位；對應後端 Membership。
export type AccountMembership = {
  id: number;
  user_id: number;
  user_name: string;
  building_id: number;
  building_name: string;
  unit_id: number;
  unit_label: string;
  occupancy_id: number;
  status: "active" | "exit_requested" | "revoked";
  joined_at: string;
  left_at: string | null;
};

// /me 的入住與管理範圍在 user 外層，不能只讀 result.user。
export type Account = {
  user: CurrentUser;
  memberships: AccountMembership[];
  managed_building_ids: number[];
};

export async function getAccount(): Promise<Account | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (baseUrl === undefined) {
    throw new Error("系統連線設定不完整。");
  }

  const response = await fetch(`${baseUrl}/api/users/me`, {
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) return null;

  if (!response.ok) {
    throw new Error("無法取得帳號資料，請稍後重試。");
  }

  return response.json();
}

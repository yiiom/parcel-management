import type { UnitPage } from "@/api/units";
import type { OccupancyPage } from "@/api/occupancies";

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type InviteCode = {
  id: number;
  occupancy_id: number;
  status: "active" | "expired" | "inactive";
  expires_at: string;
  disabled_at: string | null;
  created_by: number;
  created_at: string;
};

// 只有建立成功的回應含明碼；列表與停用結果不能查回明碼。
export type InviteCodeCreated = InviteCode & {
  code: string;
};

export type InvitationVerified = {
  building_id: number;
  building_name: string;
  unit_id: number;
  unit_label: string;
  expires_at: string;
  occupancy_id: number;
};

export type Membership = {
  id: number;
  user_id: number;
  user_name: string;
  building_id: number;
  building_name: string;
  unit_id: number;
  unit_label: string;
  status: "active" | "exit_requested" | "revoked";
  joined_at: string;
  left_at: string | null;
  occupancy_id: number;
  exit_requested_at: string | null;
  revoked_by: number | null;
};

export class InvitationApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "InvitationApiError";
  }
}

export function toInvitationError(cause: unknown): InvitationApiError {
  if (cause instanceof InvitationApiError) return cause;

  return new InvitationApiError(
    0,
    "NETWORK_ERROR",
    "連線中斷或逾時，尚無法確認操作結果。請重新查詢目前資料。",
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (baseUrl === undefined) {
    throw new InvitationApiError(
      0,
      "CONFIG_ERROR",
      "系統連線設定不完整。",
    );
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (cause) {
    throw toInvitationError(cause);
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = body && typeof body === "object" ? body : {};

    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "操作未完成，請稍後再試。";

    const code =
      "code" in error && typeof error.code === "string"
        ? error.code
        : "REQUEST_FAILED";

    const header = response.headers.get("Retry-After");
    const seconds = header === null ? NaN : Number(header);

    throw new InvitationApiError(
      response.status,
      code,
      message,
      Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    // 寫入可能已成功，不能因回應無法解析就自動重送。
    throw new InvitationApiError(
      0,
      "INVALID_RESPONSE",
      "無法讀取伺服器回應，請重新查詢目前資料。",
    );
  }
}

// 2D 選擇器沿用既有查詢端點。
// 使用同一個錯誤類別，讓新頁面能明確區分 401、403 等狀態。
export function getInvitationUnits(buildingId: number, page = 1) {
  return request<UnitPage>(
    `/buildings/${buildingId}/units?page=${page}&page_size=20`,
  );
}

export function getInvitationOccupancies(unitId: number, page = 1) {
  return request<OccupancyPage>(
    `/units/${unitId}/occupancies?page=${page}&page_size=20`,
  );
}

export function getInviteCodes(occupancyId: number, page = 1) {
  return request<Page<InviteCode>>(
    `/occupancies/${occupancyId}/invite-codes?page=${page}&page_size=20`,
  );
}

export function createInviteCode(occupancyId: number) {
  // 此端點不接受 body；四位碼與固定 24 小時期限由後端決定。
  return request<InviteCodeCreated>(
    `/occupancies/${occupancyId}/invite-codes`,
    { method: "POST" },
  );
}

export function deactivateInviteCode(codeId: number) {
  return request<InviteCode>(
    `/invite-codes/${codeId}/deactivate`,
    { method: "POST" },
  );
}

function invitationBody(code: string): RequestInit {
  if (!/^[0-9]{4}$/.test(code)) {
    throw new InvitationApiError(
      422,
      "LOCAL_CODE_FORMAT",
      "請輸入四位半形數字邀請碼。",
    );
  }

  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invite_code: code }),
  };
}

export async function verifyInvitation(code: string) {
  // 驗證只取得預覽資料，不授予入住資格。
  return request<InvitationVerified>(
    "/unit-invitations/verify",
    invitationBody(code),
  );
}

export async function joinUnit(code: string) {
  // 只傳邀請碼，不接受前端指定他人帳號或入住 ID。
  // 首次加入 201、同批次重試 200 都是成功結果。
  return request<Membership>(
    "/unit-memberships",
    invitationBody(code),
  );
}

export function getMemberships(
  buildingId: number,
  filters: {
    page?: number;
    unitId?: number;
    occupancyId?: number;
    status?: Membership["status"];
  } = {},
) {
  const query = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: "20",
  });

  if (filters.unitId !== undefined) {
    query.set("unit_id", String(filters.unitId));
  }
  if (filters.occupancyId !== undefined) {
    query.set("occupancy_id", String(filters.occupancyId));
  }
  if (filters.status !== undefined) {
    query.set("status", filters.status);
  }

  return request<Page<Membership>>(
    `/buildings/${buildingId}/memberships?${query}`,
  );
}

import {
  InvitationApiError,
  type Page,
} from "@/api/invitations";
import type { Occupancy, OccupancyPage } from "@/api/occupancies";

export type ParcelStatus =
  | "pending"
  | "picked_up"
  | "exception"
  | "returned";

// 只列出一般包裹 API 允許回傳的欄位，不包含取件碼、密文或雜湊。
export type Parcel = {
  id: number;
  building_id: number;
  unit_id: number;
  unit_label: string;
  occupancy_id: number;
  recipient_name: string;
  courier: string | null;
  tracking_number: string | null;
  storage_location: string | null;
  note: string | null;
  status: ParcelStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
  active_verification_id: number | null;
  picked_up_at: string | null;
  exception_reason: string | null;
  exception_reported_by: number | null;
  exception_reported_at: string | null;
  resolution_note: string | null;
  resolved_by: number | null;
  resolved_at: string | null;
};

export type ParcelInput = {
  occupancy_id: number;
  recipient_name: string;
  courier: string | null;
  tracking_number: string | null;
  storage_location: string | null;
  note: string | null;
};

export type ParcelUpdate = Partial<ParcelInput>;

export type ParcelFilters = {
  building_id?: number;
  unit_id?: number;
  occupancy_id?: number;
  status?: ParcelStatus;
  keyword?: string;
};

// 繼承現有錯誤類別，讓 2D 共用 Query／RequestError 能辨識 HTTP 狀態。
// 既有 2D API 與頁面不需要修改。
export class ParcelApiError extends InvitationApiError {
  constructor(
    status: number,
    code: string,
    message: string,
    public existingParcels: Parcel[] = [],
  ) {
    super(status, code, message);
    this.name = "ParcelApiError";
  }
}

export function toParcelError(cause: unknown): ParcelApiError {
  if (cause instanceof ParcelApiError) return cause;

  if (cause instanceof InvitationApiError) {
    return new ParcelApiError(cause.status, cause.code, cause.message);
  }

  return new ParcelApiError(
    0,
    "NETWORK_ERROR",
    "連線中斷或逾時，尚無法確認操作結果，請重新查詢目前資料。",
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (baseUrl === undefined) {
    throw new ParcelApiError(
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
    throw toParcelError(cause);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body && typeof body === "object" ? body : {};

    const code =
      "code" in error && typeof error.code === "string"
        ? error.code
        : "REQUEST_FAILED";

    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "操作未完成，請稍後再試。";

    const existing =
      response.status === 409 &&
      code === "DUPLICATE_PARCEL_CONFIRMATION_REQUIRED" &&
      "existing_parcels" in error &&
      Array.isArray(error.existing_parcels)
        ? (error.existing_parcels as Parcel[])
        : [];

    throw new ParcelApiError(
      response.status,
      code,
      message,
      existing,
    );
  }

  if (body === null) {
    // 寫入可能已成功，不因回應解析失敗而自動重送。
    throw new ParcelApiError(
      0,
      "INVALID_RESPONSE",
      "無法讀取伺服器回應，請重新查詢目前資料。",
    );
  }

  return body as T;
}

export function getParcels(
  filters: ParcelFilters = {},
  page = 1,
): Promise<Page<Parcel>> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: "20",
  });

  if (filters.building_id !== undefined) {
    query.set("building_id", String(filters.building_id));
  }
  if (filters.unit_id !== undefined) {
    query.set("unit_id", String(filters.unit_id));
  }
  if (filters.occupancy_id !== undefined) {
    query.set("occupancy_id", String(filters.occupancy_id));
  }
  if (filters.status) query.set("status", filters.status);
  if (filters.keyword) query.set("keyword", filters.keyword);

  return request(`/parcels?${query}`);
}

export function getParcel(parcelId: number): Promise<Parcel> {
  return request(`/parcels/${parcelId}`);
}

export function createParcel(
  data: ParcelInput,
  duplicateConfirmed = false,
): Promise<Parcel> {
  // 明確列出白名單，不接受前端設定狀態、登記人、時間或取件碼。
  return request("/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      occupancy_id: data.occupancy_id,
      recipient_name: data.recipient_name,
      courier: data.courier,
      tracking_number: data.tracking_number,
      storage_location: data.storage_location,
      note: data.note,
      duplicate_confirmed: duplicateConfirmed,
    }),
  });
}

export function updateParcel(
  parcelId: number,
  changes: ParcelUpdate,
): Promise<Parcel> {
  if (Object.keys(changes).length === 0) {
    throw new ParcelApiError(
      422,
      "NO_CHANGES",
      "沒有變更資料，未送出更正。",
    );
  }

  return request(`/parcels/${parcelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}

export function getParcelOccupancies(
  unitId: number,
  page = 1,
): Promise<OccupancyPage> {
  return request(
    `/units/${unitId}/occupancies?page=${page}&page_size=20`,
  );
}

// 更正前查明原入住是否已結束。
// 原入住可能位於歷史分頁，不能只查看第一頁。
export async function getSourceOccupancy(
  parcel: Parcel,
): Promise<Occupancy> {
  let page = 1;
  let pages = 1;

  do {
    const result = await getParcelOccupancies(parcel.unit_id, page);

    const source = result.items.find(
      (item) => item.id === parcel.occupancy_id,
    );
    if (source) return source;

    pages = Math.max(1, Math.ceil(result.total / result.page_size));
    page += 1;
  } while (page <= pages);

  throw new ParcelApiError(
    404,
    "OCCUPANCY_NOT_FOUND",
    "找不到原入住紀錄，請關閉表單後重新查詢包裹。",
  );
}

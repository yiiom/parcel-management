import {
  InvitationApiError,
  type Page,
} from "@/api/invitations";
import type { Parcel } from "@/api/parcels";

export type PickupVerification = {
  id: number;
  parcel_id: number;
  unit_label: string;
  status:
    | "awaiting_confirmation"
    | "completed"
    | "expired"
    | "cancelled";
  verified_by: number;
  verified_at: string;
  expires_at: string;
  updated_at: string;
  pickup_id: number | null;
  courier: string | null;
};

export type Pickup = {
  id: number;
  parcel_id: number;
  verification_id: number;
  occupancy_id: number;
  building_name: string;
  unit_label: string;
  floor: string;
  recipient_name: string;
  courier: string | null;
  tracking_number: string | null;
  handled_by: number;
  handled_by_name: string;
  picked_up_by: number;
  picked_up_by_name: string;
  picked_up_at: string;
};

export type PickupFilters = {
  building_id?: number;
  unit_id?: number;
  occupancy_id?: number;
  date_from?: string;
  date_to?: string;
};

export type PickupSnapshot = {
  parcel: Parcel;
  verification: PickupVerification | null;
  receipt: Pickup | null;
  code: string | null;
};

// 沿用共用查詢元件能辨識的 HTTP 錯誤型別。
export class PickupApiError extends InvitationApiError {
  constructor(
    status: number,
    code: string,
    message: string,
    retryAfterSeconds: number | null = null,
  ) {
    super(status, code, message, retryAfterSeconds);
    this.name = "PickupApiError";
  }
}

export function toPickupError(cause: unknown): PickupApiError {
  if (cause instanceof PickupApiError) return cause;

  if (cause instanceof InvitationApiError) {
    return new PickupApiError(
      cause.status,
      cause.code,
      cause.message,
      cause.retryAfterSeconds,
    );
  }

  return new PickupApiError(
    0,
    "NETWORK_ERROR",
    "連線中斷或逾時，請重新查詢目前狀態。",
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (baseUrl === undefined) {
    throw new PickupApiError(
      0,
      "CONFIG_ERROR",
      "系統連線設定不完整。",
    );
  }

  const signal = init.signal
    ? AbortSignal.any([
        init.signal,
        AbortSignal.timeout(30_000),
      ])
    : AbortSignal.timeout(30_000);

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch (cause) {
    // 離頁取消的查詢交由輪詢控制器丟棄。
    if (init.signal?.aborted) throw cause;
    throw toPickupError(cause);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body && typeof body === "object" ? body : {};
    const header = response.headers.get("Retry-After");
    const seconds = header === null ? NaN : Number(header);

    throw new PickupApiError(
      response.status,
      "code" in error && typeof error.code === "string"
        ? error.code
        : "REQUEST_FAILED",
      "message" in error && typeof error.message === "string"
        ? error.message
        : "操作未完成，請稍後重試。",
      Number.isFinite(seconds) && seconds > 0
        ? seconds
        : null,
    );
  }

  if (body === null) {
    // 寫入可能已完成，不能因回應遺失就自行判定失敗。
    throw new PickupApiError(
      0,
      "INVALID_RESPONSE",
      "無法讀取操作結果，請重新查詢目前狀態。",
    );
  }

  return body as T;
}

export function getPickupCode(
  parcelId: number,
  signal?: AbortSignal,
) {
  return request<{
    parcel_id: number;
    pickup_code: string;
  }>(`/parcels/${parcelId}/pickup-code`, { signal });
}

export async function createPickupVerification(
  buildingId: number,
  code: string,
) {
  if (!/^[0-9]{6}$/.test(code)) {
    throw new PickupApiError(
      422,
      "LOCAL_CODE_FORMAT",
      "請輸入六位半形數字取件碼。",
    );
  }

  return request<PickupVerification>("/pickup-verifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      building_id: buildingId,
      pickup_code: code, // 使用字串，保留開頭的 0。
    }),
  });
}

export function getPickupVerification(
  verificationId: number,
  signal?: AbortSignal,
) {
  return request<PickupVerification>(
    `/pickup-verifications/${verificationId}`,
    { signal },
  );
}

export function confirmPickup(verificationId: number) {
  // 簽收者由後端登入身分取得，不傳帳號、時間或 body。
  return request<Pickup>(
    `/pickup-verifications/${verificationId}/confirm`,
    { method: "POST" },
  );
}

export function cancelPickupVerification(verificationId: number) {
  // 管理員只能取消自己經手的未完成驗證。
  return request<PickupVerification>(
    `/pickup-verifications/${verificationId}/cancel`,
    { method: "POST" },
  );
}

export function getPickups(
  filters: PickupFilters = {},
  page = 1,
  signal?: AbortSignal,
  pageSize = 20,
) {
  if (
    filters.date_from &&
    filters.date_to &&
    filters.date_from > filters.date_to
  ) {
    throw new PickupApiError(
      422,
      "DATE_RANGE",
      "起始日期不可晚於結束日期。",
    );
  }

  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
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
  if (filters.date_from) {
    query.set("date_from", filters.date_from);
  }
  if (filters.date_to) {
    query.set("date_to", filters.date_to);
  }

  return request<Page<Pickup>>(`/pickups?${query}`, { signal });
}

// 現有 API 沒有單筆簽收紀錄端點，依有權限的入住分頁查找。
// 不假設紀錄一定在第一頁。
export async function findPickup(
  parcelId: number,
  occupancyId: number,
  signal?: AbortSignal,
  verificationId?: number,
): Promise<Pickup> {
  let page = 1;
  let pages = 1;

  do {
    const result = await getPickups(
      { occupancy_id: occupancyId },
      page,
      signal,
      100,
    );

    const found = result.items.find(
      (item) =>
        item.parcel_id === parcelId &&
        (verificationId === undefined ||
          item.verification_id === verificationId),
    );

    if (found) return found;

    pages = Math.max(
      1,
      Math.ceil(result.total / result.page_size),
    );
    page += 1;
  } while (page <= pages);

  throw new PickupApiError(
    404,
    "PICKUP_NOT_FOUND",
    "目前無法查詢此簽收紀錄，請重新確認資格與資料。",
  );
}

function readParcel(parcelId: number, signal?: AbortSignal) {
  return request<Parcel>(`/parcels/${parcelId}`, { signal });
}

function changed() {
  return new PickupApiError(
    409,
    "STATE_CHANGED",
    "包裹或驗證狀態已變更，請重新查詢並核對。",
  );
}

// 組合畫面需要的最新資料；任何一步失敗都不回傳部分成功畫面。
export async function loadPickupSnapshot(
  options: {
    parcelId?: number;
    verificationId?: number;
    knownVerificationId?: number;
    resident: boolean;
    includeCode: boolean;
  },
  signal: AbortSignal,
): Promise<PickupSnapshot> {
  let verification = options.verificationId
    ? await getPickupVerification(options.verificationId, signal)
    : null;

  const parcelId =
    options.parcelId ?? verification?.parcel_id;

  if (parcelId === undefined) {
    throw new PickupApiError(
      422,
      "MISSING_TARGET",
      "缺少包裹或驗證資料。",
    );
  }

  let parcel = await readParcel(parcelId, signal);

  if (options.resident) {
    const id =
      parcel.active_verification_id ??
      options.knownVerificationId;

    if (id !== undefined && id !== null) {
      verification = await getPickupVerification(id, signal);
    }
  }

  if (
    verification &&
    verification.parcel_id !== parcel.id
  ) {
    throw changed();
  }

  let receipt: Pickup | null = null;

  if (
    parcel.status === "picked_up" ||
    verification?.status === "completed"
  ) {
    receipt = await findPickup(
      parcel.id,
      parcel.occupancy_id,
      signal,
    );

    parcel = await readParcel(parcel.id, signal);

    if (parcel.status !== "picked_up") throw changed();

    if (
      options.resident &&
      verification?.id !== receipt.verification_id
    ) {
      verification = await getPickupVerification(
        receipt.verification_id,
        signal,
      );
    }
  } else {
    const latest = await readParcel(parcel.id, signal);

    if (
      latest.updated_at !== parcel.updated_at ||
      latest.active_verification_id !==
        parcel.active_verification_id
    ) {
      throw changed();
    }

    parcel = latest;

    if (
      verification?.status === "awaiting_confirmation" &&
      (parcel.status !== "pending" ||
        parcel.active_verification_id !== verification.id)
    ) {
      throw changed();
    }
  }

  let code: string | null = null;

  if (
    options.resident &&
    options.includeCode &&
    parcel.status === "pending" &&
    !receipt &&
    (!verification ||
      verification.status === "awaiting_confirmation")
  ) {
    const result = await getPickupCode(parcel.id, signal);
    const latest = await readParcel(parcel.id, signal);

    // 取碼期間發生更正、簽收或驗證變動，丟棄剛取得的碼。
    if (
      latest.updated_at !== parcel.updated_at ||
      latest.status !== "pending" ||
      latest.active_verification_id !==
        parcel.active_verification_id
    ) {
      throw changed();
    }

    code = result.pickup_code;
    parcel = latest;
  }

  return { parcel, verification, receipt, code };
}

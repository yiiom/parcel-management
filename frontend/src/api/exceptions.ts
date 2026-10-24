import type { Occupancy } from "@/api/occupancies";
import {
  getParcel,
  getSourceOccupancy,
  ParcelApiError,
  toParcelError,
  type Parcel,
} from "@/api/parcels";

export type ExceptionContext = {
  parcel: Parcel;
  occupancy: Occupancy;
};

export type ExceptionResolutionStatus = "pending" | "returned";

// 同時比較包裹版本及入住結束時間。
// 入住在另一個畫面結束後，原本的恢復確認也必須失效。
export function exceptionVersion(context: ExceptionContext) {
  return JSON.stringify([
    context.parcel.id,
    context.parcel.updated_at,
    context.parcel.status,
    context.parcel.occupancy_id,
    context.parcel.active_verification_id,
    context.occupancy.id,
    context.occupancy.ended_at,
  ]);
}

// 沿用 3A 的分頁查找，包含已結束的歷史入住。
// 不把「第一頁找不到」當成入住不存在。
export async function getExceptionContext(
  parcelId: number,
): Promise<ExceptionContext> {
  const parcel = await getParcel(parcelId);
  const occupancy = await getSourceOccupancy(parcel);
  const latest = await getParcel(parcelId);

  if (
    latest.updated_at !== parcel.updated_at ||
    latest.occupancy_id !== parcel.occupancy_id ||
    latest.status !== parcel.status ||
    latest.active_verification_id !== parcel.active_verification_id
  ) {
    throw new ParcelApiError(
      409,
      "STATE_CHANGED",
      "包裹資料已變更，請重新查詢並核對。",
    );
  }

  return { parcel: latest, occupancy };
}

async function writeException(
  path: string,
  method: "PUT" | "POST",
  body: {
    exception_reason: string;
  } | {
    status: ExceptionResolutionStatus;
    resolution_note: string;
  },
): Promise<Parcel> {
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
      method,
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (cause) {
    // 寫入可能已完成；呼叫端必須重新查詢，不能自動重送。
    throw toParcelError(cause);
  }

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error =
      result && typeof result === "object" ? result : {};

    throw new ParcelApiError(
      response.status,
      "code" in error && typeof error.code === "string"
        ? error.code
        : "REQUEST_FAILED",
      "message" in error && typeof error.message === "string"
        ? error.message
        : "操作未完成，請重新查詢目前資料。",
    );
  }

  if (result === null) {
    throw new ParcelApiError(
      0,
      "INVALID_RESPONSE",
      "無法讀取操作結果，請先重新查詢，不要直接重送。",
    );
  }

  return result as Parcel;
}

export function reportParcelException(
  parcelId: number,
  reason: string,
): Promise<Parcel> {
  const value = reason.trim();

  if (!value) {
    throw new ParcelApiError(
      422,
      "EMPTY_EXCEPTION_REASON",
      "請填寫異常原因，不能只有空白。",
    );
  }

  // 不傳操作者、時間或其他包裹欄位。
  return writeException(
    `/parcels/${parcelId}/exception`,
    "PUT",
    { exception_reason: value },
  );
}

export function resolveParcelException(
  parcelId: number,
  status: ExceptionResolutionStatus,
  note: string,
): Promise<Parcel> {
  const value = note.trim();

  if (!value) {
    throw new ParcelApiError(
      422,
      "EMPTY_RESOLUTION_NOTE",
      "請填寫處理結果，不能只有空白。",
    );
  }

  // 再做執行期白名單檢查，不能藉此直接標成已簽收。
  if (status !== "pending" && status !== "returned") {
    throw new ParcelApiError(
      422,
      "INVALID_RESOLUTION_STATUS",
      "處理結果只能選擇恢復待領或實際退回物流。",
    );
  }

  return writeException(
    `/parcels/${parcelId}/exception/resolve`,
    "POST",
    {
      status,
      resolution_note: value,
    },
  );
}

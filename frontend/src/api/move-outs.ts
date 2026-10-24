import type { Account } from "@/api/account";
import type { Occupancy } from "@/api/occupancies";
import type { Parcel } from "@/api/parcels";
import type { Unit } from "@/api/units";
import {
  InvitationApiError,
  toInvitationError,
  type InviteCode,
  type Membership,
  type Page,
} from "@/api/invitations";

export type ResidentState = {
  userId: number;
  userName: string;
  member: Membership | null;
};

export type MoveOutImpact = {
  unit: Unit;
  occupancy: Occupancy;
  members: Membership[];
  invites: InviteCode[];
  parcels: Parcel[];
};

export type RevokeImpact = MoveOutImpact & {
  target: Membership;
};

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

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body && typeof body === "object" ? body : {};

    throw new InvitationApiError(
      response.status,
      "code" in error && typeof error.code === "string"
        ? error.code
        : "REQUEST_FAILED",
      "message" in error && typeof error.message === "string"
        ? error.message
        : "操作未完成，請重新查詢目前資料。",
    );
  }

  if (body === null) {
    // 寫入可能已完成，不能因回應遺失就自動重送。
    throw new InvitationApiError(
      0,
      "INVALID_RESPONSE",
      "無法讀取操作結果，請先重新查詢目前狀態。",
    );
  }

  return body as T;
}

// 影響預覽必須讀取全部分頁，不只顯示第一頁就允許確認。
async function readAll<T extends { id: number }>(
  load: (page: number) => Promise<Page<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let pages = 1;

  do {
    const result = await load(page);
    items.push(...result.items);
    pages = Math.max(1, Math.ceil(result.total / result.page_size));
    page += 1;
  } while (page <= pages);

  return items.sort((a, b) => a.id - b.id);
}

export async function readResidentState(): Promise<ResidentState> {
  // 使用完整 Membership 型別，取得退出申請時間。
  const account = await request<
    Omit<Account, "memberships"> & { memberships: Membership[] }
  >("/users/me");

  if (account.user.role !== "resident") {
    throw new InvitationApiError(
      403,
      "FORBIDDEN",
      "只有住戶可查看自己的入住與申請退出。",
    );
  }

  return {
    userId: account.user.id,
    userName: account.user.name,
    member:
      account.memberships.find(
        (item) =>
          item.status === "active" ||
          item.status === "exit_requested",
      ) ?? null,
  };
}

export function residentVersion(data: ResidentState) {
  return JSON.stringify(data);
}

export function exitRequested(data: ResidentState) {
  return (
    data.member === null ||
    data.member.status === "exit_requested"
  );
}

export function hasMembership(data: ResidentState) {
  return data.member !== null;
}

export function requestMembershipExit(membershipId: number) {
  // 身分由登入 Cookie 決定，不傳 user_id 或其他 body。
  return request<Membership>(
    `/unit-memberships/${membershipId}/exit-request`,
    { method: "POST" },
  );
}

export function revokeMembership(membershipId: number) {
  return request<Membership>(
    `/unit-memberships/${membershipId}/revoke`,
    { method: "POST" },
  );
}

export function endOccupancy(occupancyId: number) {
  // 多表更新由既有後端交易一次完成。
  return request<Occupancy>(
    `/occupancies/${occupancyId}/end`,
    { method: "POST" },
  );
}

async function readImpactOnce(
  buildingId: number,
  unitId: number,
  occupancyId: number,
): Promise<MoveOutImpact> {
  // 後端以同一把業務鎖處理查詢，依序讀取可避免同時競爭連線。
  // 外層仍會完整讀取兩次並比較，不能沿用變更前的影響預覽。
  const units = await readAll<Unit>((page) =>
    request(
      `/buildings/${buildingId}/units?page=${page}&page_size=100`,
    ),
  );
  const occupancies = await readAll<Occupancy>((page) =>
    request(
      `/units/${unitId}/occupancies?page=${page}&page_size=100`,
    ),
  );
  const members = await readAll<Membership>((page) =>
    request(
      `/buildings/${buildingId}/memberships` +
      `?occupancy_id=${occupancyId}&page=${page}&page_size=100`,
    ),
  );
  const invites = await readAll<InviteCode>((page) =>
    request(
      `/occupancies/${occupancyId}/invite-codes` +
      `?page=${page}&page_size=100`,
    ),
  );
  const parcels = await readAll<Parcel>((page) =>
    request(
      `/parcels?occupancy_id=${occupancyId}` +
      `&page=${page}&page_size=100`,
    ),
  );

  const unit = units.find((item) => item.id === unitId);
  const occupancy = occupancies.find(
    (item) => item.id === occupancyId,
  );

  if (
    !unit ||
    !occupancy ||
    unit.building_id !== buildingId ||
    occupancy.unit_id !== unit.id
  ) {
    throw new InvitationApiError(
      404,
      "TARGET_NOT_FOUND",
      "找不到這次入住，請重新選擇戶別與入住。",
    );
  }

  return { unit, occupancy, members, invites, parcels };
}

export function impactVersion(data: MoveOutImpact) {
  // 比較成員、邀請碼及包裹內容，防止沿用變更前的預覽。
  return JSON.stringify({
    unit: data.unit,
    occupancy: data.occupancy,
    members: data.members,
    invites: data.invites,
    parcels: data.parcels,
  });
}

export async function readMoveOutImpact(
  buildingId: number,
  unitId: number,
  occupancyId: number,
): Promise<MoveOutImpact> {
  const first = await readImpactOnce(
    buildingId,
    unitId,
    occupancyId,
  );
  const latest = await readImpactOnce(
    buildingId,
    unitId,
    occupancyId,
  );

  if (impactVersion(first) !== impactVersion(latest)) {
    throw new InvitationApiError(
      409,
      "STATE_CHANGED",
      "預覽期間資料有變更，請重新查詢後再核對。",
    );
  }

  return latest;
}

export async function readRevokeImpact(
  buildingId: number,
  member: Membership,
): Promise<RevokeImpact> {
  const impact = await readMoveOutImpact(
    buildingId,
    member.unit_id,
    member.occupancy_id,
  );

  const target = impact.members.find(
    (item) => item.id === member.id,
  );

  if (!target) {
    throw new InvitationApiError(
      404,
      "MEMBERSHIP_NOT_FOUND",
      "找不到此資格紀錄，請關閉視窗後更新名單。",
    );
  }

  return { ...impact, target };
}

export function membershipRevoked(data: RevokeImpact) {
  return data.target.status === "revoked";
}

export function occupancyEnded(data: MoveOutImpact) {
  return data.occupancy.ended_at !== null;
}

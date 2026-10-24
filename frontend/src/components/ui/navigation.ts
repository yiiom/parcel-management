import type { CurrentUser } from "@/api/auth";

export type Role = CurrentUser["role"];

export type MenuItem = {
  label: string;
  href: string;
  demo?: boolean;
};

export const roleNames: Record<Role, string> = {
  system_admin: "系統管理員",
  building_admin: "大樓管理員",
  resident: "住戶",
};

// 只整理導覽，不更動既有網址或角色授權。
export function getManagerGroups(buildingId?: number) {
  return [
    { label: "包裹管理", items: [
      { label: "包裹列表", href: "/parcels" },
      { label: "異常處理", href: "/exceptions" },
    ] },
    { label: "取件作業", items: [
      { label: "取件驗證", href: "/pickup" },
      { label: "簽收紀錄", href: "/pickups" },
    ] },
    { label: "戶別與邀請碼", items: [
      ...(buildingId ? [{ label: "戶別與入住", href: `/buildings/${buildingId}/units` }] : []),
      { label: "邀請碼管理", href: "/invitations" },
    ] },
    { label: "住戶管理", items: [
      { label: "住戶名單", href: "/members" },
      { label: "退出處理", href: "/move-outs" },
      { label: "結束入住", href: "/move-outs/end" },
    ] },
    { label: "大樓設定", items: [
      ...(buildingId ? [{ label: "我的大樓", href: `/buildings/${buildingId}` }] : []),
      { label: "個人資料", href: "/profile" },
      { label: "首頁", href: "/workspace/building_admin" },
    ] },
  ];
}

export function managerGroupForPath(path: string, buildingId?: number) {
  const groups = getManagerGroups(buildingId);
  if (path === "/workspace/building_admin" && buildingId) return groups[0];
  if (/^\/units\/[^/]+\/occupancies$/.test(path)) return groups[2];
  return groups.flatMap((group) => group.items.map((item) => ({ group, item })))
    .filter(({ item }) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.item.href.length - a.item.href.length)[0]?.group;
}

export function getResidentGroups() {
  return [
    { label: "加入戶別", items: [{ label: "加入戶別", href: "/join" }] },
    { label: "我的包裹", items: [{ label: "我的包裹", href: "/parcels" }, { label: "首頁", href: "/workspace/resident" }] },
    { label: "簽收紀錄", items: [{ label: "簽收紀錄", href: "/pickups" }] },
    { label: "我的戶別", items: [{ label: "我的戶別", href: "/household" }, { label: "個人資料", href: "/profile" }] },
  ];
}

export function getMenu(role: Role, buildingId?: number): MenuItem[] {
  const common: MenuItem[] = [
    { label: "首頁", href: `/workspace/${role}` },
  ];

  if (role === "system_admin") {
    return [
      ...common,
      { label: "大樓管理", href: "/buildings" },
      { label: "管理員管理", href: "/building-admins" },
      { label: "個人資料", href: "/profile" },
    ];
  }

  if (role === "building_admin") {
    return [
      ...common,
      ...(buildingId
        ? [
            {
              label: "我的大樓",
              href: `/buildings/${buildingId}`,
            },
            {
              label: "戶別與入住",
              href: `/buildings/${buildingId}/units`,
            },
          ]
        : []),
      // 邀請、名單與搬離操作皆使用目前系統資料。
      { label: "邀請碼管理", href: "/invitations" },
      { label: "住戶名單", href: "/members" },
      { label: "退出處理", href: "/move-outs" },
      { label: "結束入住", href: "/move-outs/end" },
      // 3A 包裹管理改為真實串接。
      { label: "包裹管理", href: "/parcels" },
      { label: "取件驗證", href: "/pickup" },
      // 3C 使用真實 API，不再標示示範資料。
      { label: "異常處理", href: "/exceptions" },
      { label: "簽收紀錄", href: "/pickups" },
      { label: "個人資料", href: "/profile" },
    ];
  }

  return [
    ...common,
    { label: "我的包裹", href: "/parcels" },
    { label: "我的戶別", href: "/household" },
    { label: "加入戶別", href: "/join" },
    { label: "簽收紀錄", href: "/pickups" },
    { label: "個人資料", href: "/profile" },
  ];
}

// 補上既有網址的角色限制。
// 同角色的跨大樓、跨入住權限仍由既有 API 判定。
export function canOpenPath(path: string, role: Role) {
  if (path === "/profile") return true;

  if (path === "/household") {
    return role === "resident";
  }

  if (
    path === "/move-outs" ||
    path.startsWith("/move-outs/")
  ) {
    return role === "building_admin";
  }

  // 前端限制入口；實際所屬大樓權限仍由後端逐次檢查。
  if (
    path === "/exceptions" ||
    path.startsWith("/exceptions/")
  ) {
    return role === "building_admin";
  }

  // 管理員驗碼；住戶於自己的包裹詳情中確認收到。
  if (path === "/pickup") {
    return role === "building_admin";
  }

  if (path === "/pickups") {
    return role === "building_admin" || role === "resident";
  }

  // 跨大樓與跨入住權限仍由後端檢查。
  if (path === "/parcels") {
    return role === "building_admin" || role === "resident";
  }

  // 跨大樓存取仍由後端確認，不能只依賴前端選單。
  if (path === "/invitations" || path === "/members") {
    return role === "building_admin";
  }

  if (path.startsWith("/workspace/")) {
    return path === `/workspace/${role}`;
  }

  if (path === "/building-admins") {
    return role === "system_admin";
  }

  if (path === "/buildings") {
    return role === "system_admin";
  }

  if (/^\/buildings\/[^/]+\/units$/.test(path)) {
    return role === "building_admin";
  }

  if (/^\/units\/[^/]+\/occupancies$/.test(path)) {
    return role === "building_admin";
  }

  if (/^\/buildings\/[^/]+$/.test(path)) {
    return role === "system_admin" || role === "building_admin";
  }

  if (path === "/join") return role === "resident";



  // 未知網址交由 Next.js 的 not-found 頁面處理。
  return true;
}

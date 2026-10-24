export type ParcelStatus = "pending" | "picked_up" | "exception" | "returned";

export type DemoParcel = {
  id: string;
  occupancy: string;
  recipient: string;
  courier: string;
  tracking: string;
  location: string;
  note: string;
  receivedAt: string;
  status: ParcelStatus;
  reason: string;
  resolution: string;
};

export const parcelStatusNames: Record<ParcelStatus, string> = {
  pending: "待領取",
  picked_up: "已簽收",
  exception: "異常",
  returned: "已退回",
};

export const demoOccupancies = [
  { id: "demo-home-a", label: "森光花園・5F・501", active: true },
  { id: "demo-home-b", label: "森光花園・3F・301", active: true },
  { id: "demo-home-old", label: "森光花園・2F・201（歷史入住）", active: false },
];

export const demoParcels: DemoParcel[] = [
  {
    id: "demo-parcel-1",
    occupancy: "demo-home-a",
    recipient: "示範住戶甲",
    courier: "黑貓宅急便",
    tracking: "DEMO-001",
    location: "管理室 A 架",
    note: "請輕放",
    receivedAt: "2026-10-22T02:30:00Z",
    status: "pending",
    reason: "",
    resolution: "",
  },
  {
    id: "demo-parcel-2",
    occupancy: "demo-home-a",
    recipient: "示範住戶乙",
    courier: "中華郵政",
    tracking: "DEMO-002",
    location: "管理室 B 架",
    note: "",
    receivedAt: "2026-10-21T06:00:00Z",
    status: "exception",
    reason: "包裝破損，等待核對",
    resolution: "",
  },
  {
    id: "demo-parcel-3",
    occupancy: "demo-home-b",
    recipient: "示範住戶丙",
    courier: "新竹物流",
    tracking: "DEMO-003",
    location: "管理室",
    note: "",
    receivedAt: "2026-10-20T04:00:00Z",
    status: "picked_up",
    reason: "",
    resolution: "",
  },
  {
    id: "demo-parcel-4",
    occupancy: "demo-home-old",
    recipient: "示範前住戶",
    courier: "黑貓宅急便",
    tracking: "DEMO-004",
    location: "退件區",
    note: "",
    receivedAt: "2026-10-19T02:00:00Z",
    status: "exception",
    reason: "原住戶已搬離，待處理",
    resolution: "",
  },
  {
    id: "demo-parcel-5",
    occupancy: "demo-home-a",
    recipient: "示範住戶甲",
    courier: "",
    tracking: "",
    location: "",
    note: "",
    receivedAt: "2026-10-18T02:00:00Z",
    status: "returned",
    reason: "收件資訊不符",
    resolution: "已實際交還物流",
  },
];

export function occupancyLabel(id: string) {
  return demoOccupancies.find((item) => item.id === id)?.label ?? "未知入住";
}

export function formatTime(value: string | number) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

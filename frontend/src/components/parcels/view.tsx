import type { Parcel, ParcelStatus } from "@/api/parcels";
import { Badge } from "@/components/ui/common";
import { formatTime } from "@/components/invitations/shared";

export const parcelStatusNames: Record<ParcelStatus, string> = {
  pending: "待領取",
  picked_up: "已簽收",
  exception: "異常處理中",
  returned: "已退回物流",
};

export function ParcelBadge({ status }: { status: ParcelStatus }) {
  return (
    <Badge
      tone={
        status === "exception"
          ? "red"
          : status === "pending"
            ? "amber"
            : status === "returned"
              ? "gray"
              : "green"
      }
    >
      {parcelStatusNames[status]}
    </Badge>
  );
}

export function ParcelSummary({ parcel }: { parcel: Parcel }) {
  return (
    <>
      <div className="row-between">
        <h3>{parcel.recipient_name}</h3>
        <ParcelBadge status={parcel.status} />
      </div>

      <p>{parcel.unit_label}・入住編號 {parcel.occupancy_id}</p>
      <p>
        {parcel.courier || "未填物流公司"}・
        {parcel.tracking_number || "未填單號"}
      </p>
      <p className="muted">
        包裹編號 {parcel.id}・{formatTime(parcel.created_at)}
      </p>

      {parcel.status === "pending" &&
        parcel.active_verification_id !== null && (
          <Badge tone="amber">等待住戶確認</Badge>
        )}
    </>
  );
}

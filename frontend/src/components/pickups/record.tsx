import type { Pickup } from "@/api/pickups";
import { formatTime } from "@/components/invitations/shared";

export default function ReceiptFields({
  receipt,
}: {
  receipt: Pickup;
}) {
  return (
    <dl className="detail-grid">
      <dt>紀錄編號</dt>
      <dd>{receipt.id}</dd>
      <dt>包裹編號</dt>
      <dd>{receipt.parcel_id}</dd>
      <dt>大樓</dt>
      <dd>{receipt.building_name}</dd>
      <dt>戶別</dt>
      <dd>{receipt.unit_label}</dd>
      <dt>入住編號</dt>
      <dd>{receipt.occupancy_id}</dd>
      <dt>收件人</dt>
      <dd>{receipt.recipient_name}</dd>
      <dt>物流公司</dt>
      <dd>{receipt.courier || "未填寫"}</dd>
      <dt>物流單號</dt>
      <dd>{receipt.tracking_number || "未填寫"}</dd>
      <dt>簽收者</dt>
      <dd>{receipt.picked_up_by_name}</dd>
      <dt>經手管理員</dt>
      <dd>{receipt.handled_by_name}</dd>
      <dt>簽收時間</dt>
      <dd>{formatTime(receipt.picked_up_at)}</dd>
    </dl>
  );
}

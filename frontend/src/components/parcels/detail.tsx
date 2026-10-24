"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Parcel } from "@/api/parcels";
import { useAccount } from "@/components/app-frame";
import { Modal } from "@/components/ui/common";
import { formatTime } from "@/components/invitations/shared";
import PickupSession from "@/components/pickups/session";
import { ParcelBadge } from "./view";

export default function ParcelDetail({
  parcelId,
  manager,
  notice,
  onClose,
  onEdit,
}: {
  parcelId: number;
  manager: boolean;
  notice: string;
  onClose: () => void;
  onEdit: (parcel: Parcel) => void;
}) {
  const { account } = useAccount();
  const actionLockRef = useRef(false);

  return (
    <Modal
      title="包裹詳情"
      onClose={() => {
        if (!actionLockRef.current) onClose();
      }}
    >
      <div className="form-stack parcel-detail">
        {notice && (
          <p className="notice" role="status">{notice}</p>
        )}

        <PickupSession
          parcelId={parcelId}
          sharedLockRef={actionLockRef}
          renderParcel={(parcel, busy) => (
            <>
              <div className="row-between">
                <h3>包裹 #{parcel.id}</h3>
                <ParcelBadge status={parcel.status} />
              </div>

              <dl className="detail-grid">
                <dt>戶別</dt>
                <dd>{parcel.unit_label}</dd>
                <dt>入住編號</dt>
                <dd>{parcel.occupancy_id}</dd>
                <dt>收件人</dt>
                <dd>{parcel.recipient_name}</dd>
                <dt>物流公司</dt>
                <dd>{parcel.courier || "未填寫"}</dd>
                <dt>物流單號</dt>
                <dd>{parcel.tracking_number || "未填寫"}</dd>
                <dt>存放位置</dt>
                <dd>{parcel.storage_location || "未填寫"}</dd>
                <dt>備註</dt>
                <dd>{parcel.note || "無"}</dd>
                <dt>登記人</dt>
                <dd>
                  {parcel.created_by === account.user.id
                    ? `${account.user.name}（本人）`
                    : `帳號 #${parcel.created_by}`}
                </dd>
                <dt className="parcel-detail-time">登記時間</dt>
                <dd className="parcel-detail-time">{formatTime(parcel.created_at)}</dd>
                <dt className="parcel-detail-time">更新時間</dt>
                <dd className="parcel-detail-time">{formatTime(parcel.updated_at)}</dd>

                {parcel.picked_up_at && (
                  <>
                    <dt>簽收時間</dt>
                    <dd>{formatTime(parcel.picked_up_at)}</dd>
                  </>
                )}

                {parcel.exception_reason && (
                  <>
                    <dt>最近異常</dt>
                    <dd>{parcel.exception_reason}</dd>
                    <dt>異常時間</dt>
                    <dd>{formatTime(parcel.exception_reported_at)}</dd>
                    <dt>異常登記者</dt>
                    <dd>
                      {parcel.exception_reported_by === null
                        ? "—"
                        : `帳號 #${parcel.exception_reported_by}`}
                    </dd>
                  </>
                )}

                {parcel.resolution_note && (
                  <>
                    <dt>處理結果</dt>
                    <dd>{parcel.resolution_note}</dd>
                    <dt>處理時間</dt>
                    <dd>{formatTime(parcel.resolved_at)}</dd>
                    <dt>處理者</dt>
                    <dd>
                      {parcel.resolved_by === null
                        ? "—"
                        : `帳號 #${parcel.resolved_by}`}
                    </dd>
                  </>
                )}
              </dl>

              {manager &&
                (
                  parcel.status === "pending" ||
                  parcel.status === "exception"
                ) && (
                  <div className="actions">
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => onEdit(parcel)}
                    >
                      更正包裹資料
                    </button>

                    <Link
                      className="button"
                      href={`/exceptions/${parcel.id}`}
                      aria-disabled={busy}
                      tabIndex={busy ? -1 : undefined}
                      onClick={(event) => {
                        // 核對或簽收寫入中，先完成本次操作再離開。
                        if (busy) event.preventDefault();
                      }}
                    >
                      {parcel.status === "exception"
                        ? "處理或更新最近異常"
                        : "登記異常"}
                    </Link>
                  </div>
                )}
            </>
          )}
        />
      </div>
    </Modal>
  );
}

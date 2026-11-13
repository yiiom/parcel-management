"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import type { Membership } from "@/api/invitations";
import {
  impactVersion,
  membershipRevoked,
  readRevokeImpact,
  revokeMembership,
  type RevokeImpact,
} from "@/api/move-outs";
import {
  Query,
  formatTime,
} from "@/components/invitations/shared";
import { Modal, PageState } from "@/components/ui/common";
import ReviewedOperation from "./review";

export default function RevokeMembership({
  buildingId,
  member,
  onClose,
}: {
  buildingId: number;
  member: Membership;
  onClose: () => void;
}) {
  const lockRef = useRef(false);

  const load = useCallback(
    () => readRevokeImpact(buildingId, member),
    [buildingId, member],
  );

  const write = useCallback(
    (data: RevokeImpact) => revokeMembership(data.target.id),
    [],
  );

  return (
    <Modal
      title="確認搬離並取消資格"
      onClose={() => {
        // 核對或寫入期間不能誤關閉操作視窗。
        if (!lockRef.current) onClose();
      }}
    >
      <Query load={load}>
        {(initial) => (
          <ReviewedOperation
            initial={initial}
            load={load}
            version={impactVersion}
            done={membershipRevoked}
            write={write}
            lockRef={lockRef}
            title="取消此住戶資格"
            inlineRefresh
            successMessage="已取消此住戶的入住資格。"
            compactConfirmation={{ confirmLabel: "確認取消資格", backLabel: "返回" }}
            acknowledgement="我已核對此住戶確實搬離，並確認取消的是上方這筆資格。"
            preview={(data) => {
              const activeInvites = data.invites.filter(
                (item) => item.status === "active",
              );

              return (
                <section className="notice notice-warning revoke-impact">
                  <h3>取消後的影響</h3>
                  <ul>
                    <li>此住戶將立即失去原入住的查詢與簽收權限。</li>
                    <li>此入住的現有邀請碼將停用（目前有效 {activeInvites.length} 筆）。</li>
                    <li>其他成員資格與整戶入住不受影響。</li>
                  </ul>

                  {activeInvites.map((invite) => (
                    <p key={invite.id}>
                      邀請碼紀錄 #{invite.id}，
                      期限：{formatTime(invite.expires_at)}
                    </p>
                  ))}

                  <p>
                    其他成員需要邀請新成員時，請另產生新邀請碼。
                  </p>
                </section>
              );
            }}
          >
            {(data, refreshControl) => (
              <section className="revoke-summary">
                <div className="revoke-summary-heading">
                  <div>
                    <h3>{data.target.user_name}</h3>
                    <p>{data.target.building_name}・{data.target.unit_label}</p>
                  </div>
                  {refreshControl}
                </div>
                <p>
                    {data.target.status === "revoked"
                      ? "資格已取消"
                      : data.target.status === "exit_requested"
                        ? "住戶已申請退出"
                        : "有效資格，尚未申請退出"}
                </p>
                <details>
                  <summary>查看資格明細</summary>
                  <dl className="detail-grid">
                    <dt>資格編號</dt>
                    <dd>{data.target.id}</dd>
                    <dt>入住編號</dt>
                    <dd>{data.target.occupancy_id}</dd>
                    {data.target.exit_requested_at && (
                      <><dt>退出申請時間</dt><dd>{formatTime(data.target.exit_requested_at)}</dd></>
                    )}
                    {data.target.left_at && (
                      <><dt>取消時間</dt><dd>{formatTime(data.target.left_at)}</dd></>
                    )}
                    {data.target.revoked_by !== null && (
                      <><dt>取消管理員</dt><dd>帳號 #{data.target.revoked_by}</dd></>
                    )}
                  </dl>
                  <Link href="/invitations">前往邀請碼管理</Link>
                </details>

                {data.target.status === "revoked" && (
                  <PageState
                    kind="empty"
                    title="此資格已取消，不需再次送出"
                  >
                    <p>
                      不會覆寫原取消時間，也不會停用後來產生的新碼。
                    </p>
                  </PageState>
                )}

              </section>
            )}
          </ReviewedOperation>
        )}
      </Query>
    </Modal>
  );
}

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
            acknowledgement="我已核對此住戶確實搬離，並確認取消的是上方這筆資格。"
            preview={(data) => {
              const activeInvites = data.invites.filter(
                (item) => item.status === "active",
              );

              return (
                <div className="form-stack">
                  <p className="notice notice-warning">
                    將取消 {data.target.user_name} 的目前資格，
                    並停用此入住現有邀請碼。
                    其他成員資格不變，也不會結束整戶入住。
                  </p>

                  <p>
                    目前有效邀請碼紀錄：{activeInvites.length} 筆。
                    原始邀請碼不會顯示。
                  </p>

                  {activeInvites.map((invite) => (
                    <p key={invite.id}>
                      邀請碼紀錄 #{invite.id}，
                      期限：{formatTime(invite.expires_at)}
                    </p>
                  ))}

                  <p>
                    被取消者立即失去原入住的查詢及簽收權限。
                    其他成員需要邀請新成員時，請另產生新邀請碼。
                  </p>
                </div>
              );
            }}
          >
            {(data) => (
              <section className="panel form-stack">
                <h2>{data.target.user_name}</h2>
                <p>
                  {data.target.building_name}・
                  {data.target.unit_label}
                </p>

                <dl className="detail-grid">
                  <dt>資格編號</dt>
                  <dd>{data.target.id}</dd>
                  <dt>入住編號</dt>
                  <dd>{data.target.occupancy_id}</dd>
                  <dt>目前狀態</dt>
                  <dd>
                    {data.target.status === "revoked"
                      ? "資格已取消"
                      : data.target.status === "exit_requested"
                        ? "住戶已申請退出"
                        : "有效資格，尚未申請退出"}
                  </dd>
                  <dt>退出申請時間</dt>
                  <dd>{formatTime(data.target.exit_requested_at)}</dd>
                  <dt>取消時間</dt>
                  <dd>{formatTime(data.target.left_at)}</dd>
                  <dt>取消管理員</dt>
                  <dd>
                    {data.target.revoked_by === null
                      ? "—"
                      : `帳號 #${data.target.revoked_by}`}
                  </dd>
                </dl>

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

                <Link href="/invitations">前往邀請碼管理</Link>
              </section>
            )}
          </ReviewedOperation>
        )}
      </Query>
    </Modal>
  );
}

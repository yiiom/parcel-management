"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import {
  exitRequested,
  hasMembership,
  readResidentState,
  requestMembershipExit,
  residentVersion,
  type ResidentState,
} from "@/api/move-outs";
import { useAccount } from "@/components/app-frame";
import {
  Query,
  formatTime,
} from "@/components/invitations/shared";
import { Badge, PageState } from "@/components/ui/common";
import ReviewedOperation from "./review";

export default function HouseholdWorkspace() {
  const { account } = useAccount();
  const lockRef = useRef(false);

  const frameMember = account.memberships.find(
    (item) =>
      item.status === "active" ||
      item.status === "exit_requested",
  );

  const load = useCallback(() => readResidentState(), []);

  const write = useCallback(async (data: ResidentState) => {
    if (!data.member || data.member.status !== "active") return;

    await requestMembershipExit(data.member.id);
  }, []);

  const syncScope = useCallback((data: ResidentState) => {
    if (
      data.userId !== account.user.id ||
      data.member?.id !== frameMember?.id
    ) {
      // 資格取消或登入身分變更時，連同共用版型一起重新取得。
      // 不只更新內容區，避免側欄還顯示舊戶別。
      window.location.reload();
    }
  }, [account.user.id, frameMember?.id]);

  if (account.user.role !== "resident") {
    return (
      <PageState
        kind="forbidden"
        title="只有住戶可查看自己的戶別及申請退出"
      />
    );
  }

  return (
    <main className="form-stack">
      <div className="page-heading">
        <div>
          <h1>我的戶別與退出申請</h1>
          <p className="muted">
            申請退出後仍保有權限，直到管理員確認取消資格。
          </p>
        </div>
      </div>

      <Query load={load}>
        {(initial) => (
          <ReviewedOperation
            initial={initial}
            load={load}
            version={residentVersion}
            done={exitRequested}
            write={write}
            lockRef={lockRef}
            title="申請退出目前入住"
            acknowledgement="我確認要申請退出目前這次入住，並了解管理員確認前仍保有權限。"
            onData={syncScope}
            pollMs={3000}
            pollWhile={hasMembership}
            preview={(data) => (
              <div className="notice">
                <p>
                  將申請退出 {data.member?.building_name}・
                  {data.member?.unit_label}。
                </p>
                <p>
                  這不是立即搬離，也不會取消其他同戶成員資格。
                </p>
              </div>
            )}
          >
            {(data) => (
              data.member ? (
                <section className="panel form-stack">
                  <h2>
                    {data.member.building_name}・
                    {data.member.unit_label}
                  </h2>

                  <Badge
                    tone={
                      data.member.status === "exit_requested"
                        ? "amber"
                        : "green"
                    }
                  >
                    {data.member.status === "exit_requested"
                      ? "等待管理員確認退出"
                      : "有效入住資格"}
                  </Badge>

                  <dl className="detail-grid">
                    <dt>住戶</dt>
                    <dd>{data.userName}</dd>
                    <dt>入住編號</dt>
                    <dd>{data.member.occupancy_id}</dd>
                    <dt>加入時間</dt>
                    <dd>{formatTime(data.member.joined_at)}</dd>
                    <dt>申請退出時間</dt>
                    <dd>
                      {formatTime(data.member.exit_requested_at)}
                    </dd>
                  </dl>

                  <p>
                    {data.member.status === "exit_requested"
                      ? "申請已存在，不需重複送出；目前仍可查看包裹與確認簽收。"
                      : "如已準備搬離，可提出退出申請。"}
                  </p>

                  <div className="actions">
                    <Link href="/parcels">我的包裹</Link>
                    <Link href="/pickups">簽收紀錄</Link>
                  </div>
                </section>
              ) : (
                <PageState
                  kind="empty"
                  title="目前沒有有效入住資格"
                >
                  <p>資格取消後不能查看原入住的包裹與簽收紀錄。</p>
                  <Link href="/join">使用新的有效邀請碼加入戶別</Link>
                </PageState>
              )
            )}
          </ReviewedOperation>
        )}
      </Query>
    </main>
  );
}

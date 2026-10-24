"use client";

import Link from "next/link";
import RevokeMembership from "@/components/move-outs/revoke";
import { useCallback, useState } from "react";
import type { Unit } from "@/api/units";
import {
  getMemberships,
  type Membership,
} from "@/api/invitations";
import { useAccount } from "@/components/app-frame";
import { Badge, PageState, Pagination } from "@/components/ui/common";
import { UnitPicker } from "./selectors";
import { Query, formatTime } from "./shared";

const statusLabels: Record<Membership["status"], string> = {
  active: "有效成員",
  exit_requested: "等待退出確認",
  revoked: "資格已取消",
};

export default function MemberDirectory({
  exitMode = false,
}: {
  exitMode?: boolean;
} = {}) {
  const { account, building } = useAccount();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [selecting, setSelecting] = useState(false);

  if (account.user.role !== "building_admin") {
    return <PageState kind="forbidden" title="只有大樓管理員可查看住戶名單" />;
  }

  if (!building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  return (
    <main className="form-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{building.name}</p>
          <h1>{exitMode ? "退出處理" : "住戶名單"}</h1>
          <p className="muted">依戶別及資格狀態查看真實成員紀錄。</p>
        </div>
      </div>

      <div className="panel">
        <p>目前範圍：{unit?.label ?? "全部戶別"}</p>

        <div className="actions">
          <button
            type="button"
            className="button"
            onClick={() => setSelecting((value) => !value)}
          >
            {selecting ? "收合戶別選擇" : "選擇戶別"}
          </button>

          <button
            type="button"
            className="button"
            onClick={() => {
              setUnit(null);
              setSelecting(false);
            }}
          >
            全部戶別
          </button>
        </div>
      </div>

      {selecting && (
        <UnitPicker
          buildingId={building.id}
          onSelect={(selected) => {
            setUnit(selected);
            setSelecting(false);
          }}
        />
      )}

      <MemberResults
        key={`${building.id}:${unit?.id ?? "all"}`}
        buildingId={building.id}
        unitId={unit?.id}
        exitMode={exitMode}
      />

      <p className="muted">
        個別搬離只取消該成員資格；整戶更替請使用
        {" "}
        <Link href="/move-outs/end">結束整戶入住</Link>。
      </p>
    </main>
  );
}

function MemberResults({
  buildingId,
  unitId,
  exitMode,
}: {
  buildingId: number;
  unitId?: number;
  exitMode: boolean;
}) {
  // 退出處理預設列等待退出者；一般名單維持全部狀態。
  const [status, setStatus] =
    useState<Membership["status"] | "">(
      exitMode ? "exit_requested" : "",
    );
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Membership | null>(null);

  const load = useCallback(
    () =>
      getMemberships(buildingId, {
        page,
        unitId,
        status: status || undefined,
      }),
    [buildingId, page, unitId, status],
  );

  return (
    <section className="panel form-stack">
      <div className="toolbar">
        <label>
          資格狀態
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Membership["status"] | "");
              setPage(1);
            }}
          >
            <option value="">全部狀態</option>
            <option value="active">有效成員</option>
            <option value="exit_requested">等待退出確認</option>
            <option value="revoked">資格已取消</option>
          </select>
        </label>

        <button
          type="button"
          className="button"
          onClick={() => setRevision((value) => value + 1)}
        >
          更新名單
        </button>
      </div>

      <Query key={`${status}:${page}:${revision}`} load={load}>
        {(result) => (
          <>
            {result.items.length === 0 && (
              <PageState kind="empty" title="這一頁沒有符合條件的住戶" />
            )}

            {result.items.map((member) => (
              <article key={member.id} className="panel">
                <div className="row-between">
                  <h2>{member.user_name}</h2>
                  <Badge
                    tone={
                      member.status === "active"
                        ? "green"
                        : member.status === "exit_requested"
                          ? "amber"
                          : "gray"
                    }
                  >
                    {statusLabels[member.status]}
                  </Badge>
                </div>

                <p>{member.building_name}・{member.unit_label}</p>
                <p className="muted">入住編號：{member.occupancy_id}</p>
                <p>加入：{formatTime(member.joined_at)}</p>

                {member.exit_requested_at && (
                  <p>申請退出：{formatTime(member.exit_requested_at)}</p>
                )}
                {member.left_at && (
                  <p>資格取消：{formatTime(member.left_at)}</p>
                )}

                {member.status !== "revoked" && (
                  <button
                    type="button"
                    className="button"
                    onClick={() => setSelected(member)}
                  >
                    {member.status === "exit_requested"
                      ? "確認搬離並取消資格"
                      : "處理此成員搬離"}
                  </button>
                )}
              </article>
            ))}

            <Pagination
              page={page}
              total={result.total}
              pageSize={result.page_size}
              onChange={setPage}
            />
          </>
        )}
      </Query>

      {selected && (
        <RevokeMembership
          key={selected.id}
          buildingId={buildingId}
          member={selected}
          onClose={() => {
            setSelected(null);

            // 關閉後重新取得名單；不沿用取消前的資格狀態。
            setRevision((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}

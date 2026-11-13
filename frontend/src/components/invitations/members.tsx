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

const statusTones = {
  active: "green",
  exit_requested: "amber",
  revoked: "gray",
} as const;

export default function MemberDirectory({
  exitMode = false,
}: {
  exitMode?: boolean;
} = {}) {
  const { account, building } = useAccount();

  if (account.user.role !== "building_admin") {
    return <PageState kind="forbidden" title="只有大樓管理員可查看住戶名單" />;
  }

  if (!building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  return <MemberResults key={`${building.id}:${exitMode}`} buildingId={building.id} exitMode={exitMode} />;
}

function MemberResults({ buildingId, exitMode }: { buildingId: number; exitMode: boolean }) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [selecting, setSelecting] = useState(false);
  // 退出處理預設列等待退出者；一般名單維持全部狀態。
  const [status, setStatus] =
    useState<Membership["status"] | "">(
      exitMode ? "exit_requested" : "",
    );
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Membership | null>(null);
  const unitId = unit?.id;

  const load = useCallback(() => {
    return getMemberships(buildingId, { page, unitId, status: status || undefined });
  }, [buildingId, page, unitId, status]);

  function selectUnit(nextUnit: Unit | null) {
    setUnit(nextUnit);
    setSelecting(false);
    setPage(1);
  }

  return (
    <main className="member-directory form-stack">
      <div className="panel toolbar member-filters">
        <div className="member-unit-filter">
          <span>戶別</span>
          <button
            type="button"
            className="button"
            aria-label={`選擇戶別，目前為${unit?.label ?? "全部戶別"}`}
            aria-expanded={selecting}
            onClick={() => setSelecting((value) => !value)}
          >
            {unit?.label ?? "全部戶別"} <span aria-hidden="true">▾</span>
          </button>
        </div>
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
          className="button member-refresh"
          aria-label="更新名單"
          title="更新名單"
          onClick={() => setRevision((value) => value + 1)}
        >
          <span aria-hidden="true">↻</span>
        </button>
      </div>

      {selecting && (
        <UnitPicker
          buildingId={buildingId}
          onSelect={selectUnit}
          onSelectAll={() => selectUnit(null)}
        />
      )}

      <Query key={`${unitId ?? "all"}:${status}:${page}:${revision}`} load={load}>
        {(result) => (
          <>
            {result.items.length === 0 && (
              <PageState kind="empty" title="這一頁沒有符合條件的住戶" />
            )}

            {result.items.length > 0 && (
              <table className="member-table" role="table" aria-label={exitMode ? "退出處理名單" : "住戶名單"}>
                <thead role="rowgroup">
                  <tr role="row">
                    {["住戶", "戶別", "入住編號", "加入時間", "資格狀態", "操作"].map((heading) => (
                      <th key={heading} scope="col" role="columnheader">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {result.items.map((member) => (
                    <tr key={member.id} role="row">
                      <th scope="row" role="rowheader">{member.user_name}</th>
                      <td role="cell">
                        <MemberFieldLabel>戶別</MemberFieldLabel>
                        {member.building_name}・{member.unit_label}
                      </td>
                      <td role="cell">
                        <MemberFieldLabel>入住編號</MemberFieldLabel>
                        {member.occupancy_id}
                      </td>
                      <td role="cell">
                        <MemberFieldLabel>加入時間</MemberFieldLabel>
                        {formatTime(member.joined_at)}
                      </td>
                      <td role="cell">
                        <Badge tone={statusTones[member.status]}>
                          {statusLabels[member.status]}
                        </Badge>
                        {member.exit_requested_at && (
                          <p className="muted">申請退出：{formatTime(member.exit_requested_at)}</p>
                        )}
                        {member.left_at && (
                          <p className="muted">資格取消：{formatTime(member.left_at)}</p>
                        )}
                      </td>
                      <td role="cell">
                        {member.status === "revoked" ? "—" : (
                          <button
                            type="button"
                            className="button"
                            onClick={() => setSelected(member)}
                          >
                            {member.status === "exit_requested"
                              ? "確認搬離並取消資格"
                              : "處理搬離"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {page === 1 && result.total <= result.page_size ? (
              <p className="muted">共 {result.total} 筆</p>
            ) : (
              <Pagination
                page={page}
                total={result.total}
                pageSize={result.page_size}
                onChange={setPage}
              />
            )}
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
      <p className="muted">
        個別搬離只取消該成員資格；整戶更替請使用
        {" "}
        <Link href="/move-outs/end">結束整戶入住</Link>。
      </p>
    </main>
  );
}

function MemberFieldLabel({ children }: { children: string }) {
  return <span className="member-field-label" aria-hidden="true">{children}：</span>;
}

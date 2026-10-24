"use client";

import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Unit } from "@/api/units";
import type { Occupancy } from "@/api/occupancies";
import { getInvitationOccupancies } from "@/api/invitations";
import {
  endOccupancy,
  impactVersion,
  occupancyEnded,
  readMoveOutImpact,
  type MoveOutImpact,
} from "@/api/move-outs";
import { useAccount } from "@/components/app-frame";
import { UnitPicker } from "@/components/invitations/selectors";
import {
  Query,
  formatTime,
} from "@/components/invitations/shared";
import {
  Modal,
  PageState,
  Pagination,
} from "@/components/ui/common";
import { ParcelSummary } from "@/components/parcels/view";
import ReviewedOperation from "./review";

export type EndTarget = {
  unitId: number;
  occupancyId: number;
};

export default function EndOccupancyWorkspace({
  initialTarget,
}: {
  initialTarget?: EndTarget;
}) {
  const { account, building } = useAccount();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [target, setTarget] =
    useState<EndTarget | null>(initialTarget ?? null);
  const [revision, setRevision] = useState(0);

  if (account.user.role !== "building_admin") {
    return (
      <PageState
        kind="forbidden"
        title="只有大樓管理員可結束整戶入住"
      />
    );
  }

  if (!building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  return (
    <main className="form-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{building.name}</p>
          <h1>結束整戶入住</h1>
          <p className="muted">
            個別成員搬離請使用退出處理；整戶換人時才結束入住。
          </p>
        </div>
      </div>

      <Link href="/move-outs">前往個別退出處理</Link>

      {unit ? (
        <OccupancyChoices
          key={`${unit.id}:${revision}`}
          unit={unit}
          onBack={() => setUnit(null)}
          onSelect={(occupancy) =>
            setTarget({
              unitId: unit.id,
              occupancyId: occupancy.id,
            })
          }
        />
      ) : (
        <UnitPicker
          buildingId={building.id}
          onSelect={setUnit}
        />
      )}

      {target && (
        <EndReview
          key={`${target.unitId}:${target.occupancyId}`}
          buildingId={building.id}
          target={target}
          onClose={() => {
            setTarget(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </main>
  );
}

function OccupancyChoices({
  unit,
  onBack,
  onSelect,
}: {
  unit: Unit;
  onBack: () => void;
  onSelect: (occupancy: Occupancy) => void;
}) {
  const [page, setPage] = useState(1);

  const load = useCallback(
    () => getInvitationOccupancies(unit.id, page),
    [unit.id, page],
  );

  return (
    <section className="panel form-stack">
      <h2>{unit.label}：選擇入住</h2>
      <button type="button" className="button" onClick={onBack}>
        重選戶別
      </button>

      <Query key={page} load={load}>
        {(result) => (
          <>
            {result.items.length === 0 && (
              <PageState kind="empty" title="此戶尚無入住紀錄">
                <Link href={`/units/${unit.id}/occupancies`}>
                  前往建立入住
                </Link>
              </PageState>
            )}

            {result.items.map((occupancy) => (
              <article key={occupancy.id} className="panel">
                <h3>
                  {occupancy.ended_at ? "歷史入住" : "目前入住"}
                  ・#{occupancy.id}
                </h3>
                <p>開始：{formatTime(occupancy.started_at)}</p>
                <p>結束：{formatTime(occupancy.ended_at)}</p>
                <button
                  type="button"
                  className="button"
                  onClick={() => onSelect(occupancy)}
                >
                  {occupancy.ended_at
                    ? "查看結束結果"
                    : "檢查此入住的結束影響"}
                </button>
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
    </section>
  );
}

function EndReview({
  buildingId,
  target,
  onClose,
}: {
  buildingId: number;
  target: EndTarget;
  onClose: () => void;
}) {
  const lockRef = useRef(false);

  const load = useCallback(
    () => readMoveOutImpact(
      buildingId,
      target.unitId,
      target.occupancyId,
    ),
    [buildingId, target.unitId, target.occupancyId],
  );

  const write = useCallback(
    (data: MoveOutImpact) => endOccupancy(data.occupancy.id),
    [],
  );

  return (
    <Modal
      title="整戶結束與更替"
      onClose={() => {
        if (!lockRef.current) onClose();
      }}
    >
      <Query load={load}>
        {(initial) => (
          <ReviewedOperation
            initial={initial}
            load={load}
            version={impactVersion}
            done={occupancyEnded}
            write={write}
            lockRef={lockRef}
            title="結束這次整戶入住"
            acknowledgement="我已核對本次入住、全部受影響成員及未領包裹，確認這是整戶搬離。"
            preview={(data) => <EndImpactPreview data={data} />}
          >
            {(data) => (
              <section className="panel form-stack">
                <h2>{data.unit.label}</h2>
                <dl className="detail-grid">
                  <dt>入住編號</dt>
                  <dd>{data.occupancy.id}</dd>
                  <dt>開始時間</dt>
                  <dd>{formatTime(data.occupancy.started_at)}</dd>
                  <dt>結束時間</dt>
                  <dd>{formatTime(data.occupancy.ended_at)}</dd>
                </dl>

                {data.occupancy.ended_at ? (
                  <>
                    <p className="notice">
                      此入住已結束，不需再次送出。
                      歷史成員與包裹仍保留在原入住。
                    </p>
                    <p>
                      舊包裹只能繼續處理異常或退回，
                      不會轉給新入住，也不能恢復領取。
                    </p>
                    <div className="actions">
                      <Link href={`/units/${data.unit.id}/occupancies`}>
                        前往建立或查看新入住
                      </Link>
                      <Link href="/invitations">
                        新入住建立後產生新邀請碼
                      </Link>
                      <Link href="/exceptions">處理舊入住異常包裹</Link>
                    </div>
                  </>
                ) : (
                  <p className="notice notice-warning">
                    請先檢查完整影響清單，再確認結束。
                    結束後不會自動建立新入住。
                  </p>
                )}
              </section>
            )}
          </ReviewedOperation>
        )}
      </Query>
    </Modal>
  );
}

function EndImpactPreview({ data }: { data: MoveOutImpact }) {
  const members = data.members.filter(
    (item) => item.status !== "revoked",
  );
  const parcels = data.parcels.filter(
    (item) =>
      item.status === "pending" || item.status === "exception",
  );
  const invites = data.invites.filter(
    (item) => item.status === "active",
  );

  return (
    <div className="form-stack">
      <p className="notice notice-warning">
        同一筆後端交易會結束入住、取消有效及等待退出資格、
        停用邀請碼、取消未完成驗證，並處理下列未領包裹。
      </p>

      <h3>將取消資格的成員：{members.length} 位</h3>
      <ImpactList
        items={members}
        render={(member) => (
          <>
            <strong>{member.user_name}</strong>
            <p>
              資格 #{member.id}・
              {member.status === "exit_requested"
                ? "等待退出"
                : "有效成員"}
            </p>
          </>
        )}
      />

      <h3>目前有效邀請碼：{invites.length} 筆</h3>
      {invites.length === 0 ? (
        <p>目前沒有有效邀請碼。</p>
      ) : invites.map((invite) => (
        <p key={invite.id}>
          紀錄 #{invite.id}・期限 {formatTime(invite.expires_at)}
        </p>
      ))}

      <h3>待領及異常包裹：{parcels.length} 件</h3>
      <ImpactList
        items={parcels}
        render={(parcel) => (
          <>
            <ParcelSummary parcel={parcel} />
            {parcel.exception_reason && (
              <p style={{ whiteSpace: "pre-wrap" }}>
                最近原因：{parcel.exception_reason}
              </p>
            )}
            <p className="muted">
              {parcel.status === "pending"
                ? "結束後改為異常：原住戶已搬離，待處理。"
                : "保留異常狀態並補充搬離原因。"}
            </p>
          </>
        )}
      />

      <p>
        已簽收及已退回包裹共
        {" "}
        {data.parcels.length - parcels.length}
        {" "}
        件，其狀態不變。
      </p>

      <p>
        舊資料保留原入住歸屬；新入住與新成員不能查看舊資料。
      </p>
    </div>
  );
}

// 資料已全部讀取後，僅將畫面分頁，避免大量資料撐滿對話框。
function ImpactList<T extends { id: number }>({
  items,
  render,
}: {
  items: T[];
  render: (item: T) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const visible = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="form-stack">
      {items.length === 0 && <p>沒有受影響資料。</p>}

      {visible.map((item) => (
        <article key={item.id} className="panel">
          {render(item)}
        </article>
      ))}

      <Pagination
        page={page}
        total={items.length}
        pageSize={pageSize}
        onChange={setPage}
      />
    </section>
  );
}

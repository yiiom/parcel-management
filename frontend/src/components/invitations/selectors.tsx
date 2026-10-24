"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { Unit } from "@/api/units";
import type { Occupancy } from "@/api/occupancies";
import {
  getInvitationUnits,
  getInvitationOccupancies,
} from "@/api/invitations";
import { Badge, PageState, Pagination } from "@/components/ui/common";
import { Query, formatTime } from "./shared";

export function UnitPicker({
  buildingId,
  onSelect,
}: {
  buildingId: number;
  onSelect: (unit: Unit) => void;
}) {
  const [page, setPage] = useState(1);

  const load = useCallback(
    () => getInvitationUnits(buildingId, page),
    [buildingId, page],
  );

  return (
    <section className="panel form-stack" aria-label="選擇戶別">
      <h2>選擇戶別</h2>

      <Query key={`${buildingId}:${page}`} load={load}>
        {(result) => (
          <>
            {result.items.length === 0 ? (
              <PageState kind="empty" title="這一頁沒有戶別">
                <Link href={`/buildings/${buildingId}/units`}>
                  前往戶別與入住管理
                </Link>
              </PageState>
            ) : (
              <div className="card-grid">
                {result.items.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    className="button"
                    onClick={() => onSelect(unit)}
                  >
                    {unit.label}
                  </button>
                ))}
              </div>
            )}

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

export function OccupancyPicker({
  unit,
  onSelect,
  onBack,
}: {
  unit: Unit;
  onSelect: (occupancy: Occupancy) => void;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1);

  const load = useCallback(
    () => getInvitationOccupancies(unit.id, page),
    [unit.id, page],
  );

  return (
    <section className="panel form-stack" aria-label="選擇入住">
      <div className="row-between">
        <h2>{unit.label}：選擇入住</h2>
        <button type="button" className="button" onClick={onBack}>
          重選戶別
        </button>
      </div>

      <Query key={`${unit.id}:${page}`} load={load}>
        {(result) => (
          <>
            {result.items.length === 0 ? (
              <PageState kind="empty" title="這一頁沒有入住紀錄">
                <Link href={`/units/${unit.id}/occupancies`}>
                  前往建立或查看入住
                </Link>
              </PageState>
            ) : (
              <div className="form-stack">
                {result.items.map((occupancy) => (
                  <article key={occupancy.id} className="panel">
                    <Badge tone={occupancy.ended_at ? "gray" : "green"}>
                      {occupancy.ended_at ? "入住已結束" : "目前入住"}
                    </Badge>
                    <p>開始：{formatTime(occupancy.started_at)}</p>
                    <p>結束：{formatTime(occupancy.ended_at)}</p>
                    <p className="muted">入住編號：{occupancy.id}</p>
                    <button
                      type="button"
                      className="button"
                      onClick={() => onSelect(occupancy)}
                    >
                      {occupancy.ended_at
                        ? "查看邀請碼歷史"
                        : "管理此入住邀請碼"}
                    </button>
                  </article>
                ))}
              </div>
            )}

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

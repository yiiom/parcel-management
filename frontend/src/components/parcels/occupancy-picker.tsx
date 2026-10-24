"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { getInvitationUnits } from "@/api/invitations";
import type { Unit } from "@/api/units";
import type { Occupancy } from "@/api/occupancies";
import { getParcelOccupancies } from "@/api/parcels";
import { UnitPicker } from "@/components/invitations/selectors";
import { Query, formatTime } from "@/components/invitations/shared";
import { PageState, Pagination } from "@/components/ui/common";

export type ParcelTarget = {
  occupancy: Occupancy;
  unitLabel: string;
};

type RegistrationOption = Unit & { occupancy: Occupancy };

// 沿用既有查詢及有效入住定義，不改後端權限或送出檢查。
async function findActiveOccupancy(unitId: number): Promise<Occupancy | null> {
  let page = 1;
  while (true) {
    const result = await getParcelOccupancies(unitId, page);
    const active = result.items.find((item) => item.ended_at === null);
    if (active) return active;
    if (page * result.page_size >= result.total) return null;
    page += 1;
  }
}

export function ParcelRegistrationPicker({
  buildingId, onSelect, onClear, selected, disabled,
}: {
  buildingId: number;
  onSelect: (target: ParcelTarget) => void;
  onClear: () => void;
  selected: ParcelTarget | null;
  disabled: boolean;
}) {
  const load = useCallback(async () => {
    const units: Unit[] = [];
    let page = 1;
    while (true) {
      const result = await getInvitationUnits(buildingId, page);
      units.push(...result.items);
      if (page * result.page_size >= result.total) break;
      page += 1;
    }
    const options: RegistrationOption[] = [];
    // 限制同時查詢數量，避免大樓戶數較多時一次送出過多請求。
    for (let offset = 0; offset < units.length; offset += 5) {
      const batch = await Promise.all(units.slice(offset, offset + 5).map(async (unit) => {
        const occupancy = await findActiveOccupancy(unit.id);
        return occupancy ? { ...unit, occupancy } : null;
      }));
      for (const option of batch) if (option) options.push(option);
    }
    return options;
  }, [buildingId]);

  return (
    <Query key={buildingId} load={load}>
      {(options) => (
        <RegistrationFields options={options} onSelect={onSelect} onClear={onClear}
          selected={selected} disabled={disabled} />
      )}
    </Query>
  );
}

function RegistrationFields({ options, onSelect, onClear, selected, disabled }: {
  options: RegistrationOption[];
  onSelect: (target: ParcelTarget) => void;
  onClear: () => void;
  selected: ParcelTarget | null;
  disabled: boolean;
}) {
  const initial = options.find((option) => option.occupancy.id === selected?.occupancy.id);
  const [floor, setFloor] = useState(initial?.floor ?? "");
  // 以父層實際送出的目標作為選中值，避免畫面與送出資料不一致。
  const unitId = options.find((option) =>
    option.floor === floor && option.occupancy.id === selected?.occupancy.id)?.id ?? "";
  const floors = [...new Set(options.map((unit) => unit.floor))]
    .sort((a, b) => a.localeCompare(b, "zh-TW", { numeric: true }));
  const rooms = options.filter((unit) => unit.floor === floor)
    .sort((a, b) => a.unit_number.localeCompare(b.unit_number, "zh-TW", { numeric: true }));

  return (
    <section className="parcel-registration-location" aria-label="選擇包裹戶別">
      <div className="form-grid">
        <label>樓層
          <select value={floor} disabled={disabled || !options.length} onChange={(event) => {
            setFloor(event.target.value);
            onClear();
          }}>
            <option value="">請選擇樓層</option>
            {floors.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>房號
          <select value={unitId} disabled={disabled || !floor || !rooms.length} onChange={(event) => {
            const room = rooms.find((item) => String(item.id) === event.target.value);
            if (room) onSelect({ occupancy: room.occupancy, unitLabel: room.label });
            else onClear();
          }}>
            <option value="">{floor ? "請選擇房號" : "請先選擇樓層"}</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.unit_number}</option>)}
          </select>
        </label>
      </div>
      {!options.length && <p role="status">目前沒有可登記包裹的戶別，請先建立有效入住。</p>}
    </section>
  );
}

export default function ParcelOccupancyPicker({
  buildingId,
  onSelect,
}: {
  buildingId: number;
  onSelect: (target: ParcelTarget) => void;
}) {
  const [unit, setUnit] = useState<Unit | null>(null);

  if (!unit) {
    return <UnitPicker buildingId={buildingId} onSelect={setUnit} />;
  }

  return (
    <ActiveOccupancies
      key={unit.id}
      unit={unit}
      onBack={() => setUnit(null)}
      onSelect={onSelect}
    />
  );
}

function ActiveOccupancies({
  unit,
  onBack,
  onSelect,
}: {
  unit: Unit;
  onBack: () => void;
  onSelect: (target: ParcelTarget) => void;
}) {
  const [page, setPage] = useState(1);

  const load = useCallback(
    () => getParcelOccupancies(unit.id, page),
    [unit.id, page],
  );

  return (
    <section className="panel form-stack">
      <div className="row-between">
        <h3>{unit.label}：選擇有效入住</h3>
        <button type="button" className="button" onClick={onBack}>
          重選戶別
        </button>
      </div>

      <Query key={`${unit.id}:${page}`} load={load}>
        {(result) => {
          const active = result.items.filter(
            (item) => item.ended_at === null,
          );

          return (
            <>
              {active.length === 0 && (
                <PageState kind="empty" title="這一頁沒有有效入住">
                  <p>已結束入住不能作為登記或轉移對象。</p>
                  <Link href={`/units/${unit.id}/occupancies`}>
                    查看或建立入住
                  </Link>
                </PageState>
              )}

              {active.map((occupancy) => (
                <article key={occupancy.id} className="panel">
                  <p>入住編號：{occupancy.id}</p>
                  <p>開始：{formatTime(occupancy.started_at)}</p>
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      onSelect({ occupancy, unitLabel: unit.label })
                    }
                  >
                    選擇此有效入住
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
          );
        }}
      </Query>
    </section>
  );
}

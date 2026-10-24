"use client";

import Link from "next/link";
import {
  useCallback,
  useState,
  type SubmitEvent,
} from "react";
import type { Unit } from "@/api/units";
import {
  findPickup,
  getPickups,
  type Pickup,
  type PickupFilters,
} from "@/api/pickups";
import { useAccount } from "@/components/app-frame";
import { UnitPicker } from "@/components/invitations/selectors";
import {
  Query,
  formatTime,
} from "@/components/invitations/shared";
import { Modal, PageState, Pagination } from "@/components/ui/common";
import ReceiptFields from "./record";

export default function PickupHistory() {
  const { account, building } = useAccount();
  const manager = account.user.role === "building_admin";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [unit, setUnit] = useState<Unit | null>(null);
  const [choosingUnit, setChoosingUnit] = useState(false);
  const [filters, setFilters] = useState<PickupFilters>({});
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [formError, setFormError] = useState("");
  const [selected, setSelected] = useState<Pickup | null>(null);

  const load = useCallback(
    () => getPickups(filters, page),
    [filters, page],
  );

  const membership = account.memberships.find(
    (item) =>
      item.status === "active" ||
      item.status === "exit_requested",
  );

  if (
    account.user.role !== "building_admin" &&
    account.user.role !== "resident"
  ) {
    return <PageState kind="forbidden" title="此角色不能查詢簽收紀錄" />;
  }

  if (manager && !building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  if (!manager && !membership) {
    return (
      <PageState kind="empty" title="目前沒有有效入住資格">
        <Link href="/join">使用邀請碼加入戶別</Link>
      </PageState>
    );
  }

  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFormError("起始日期不可晚於結束日期。");
      return;
    }

    setFormError("");
    setFilters({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      unit_id: manager ? unit?.id : undefined,
    });
    setPage(1);
  }

  function selectUnit(selectedUnit: Unit | null) {
    setUnit(selectedUnit);
    setChoosingUnit(false);
    setFilters((previous) => ({
      ...previous,
      unit_id: selectedUnit?.id,
    }));
    setPage(1);
  }

  return (
    <main className="form-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {manager ? building?.name : membership?.building_name}
          </p>
          <h1>簽收紀錄</h1>
          <p className="muted">
            依簽收時間由新到舊排列，日期範圍採臺灣日期。
          </p>
        </div>
      </div>

      <section className="panel form-stack">
        <form onSubmit={search} className="form-stack">
          <div className="form-grid">
            <label>
              起始日期
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>

            <label>
              結束日期
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
          </div>

          {formError && (
            <p className="error-text" role="alert">{formError}</p>
          )}

          <div className="actions">
            <button type="submit" className="button button-primary">
              套用日期範圍
            </button>

            <button
              type="button"
              className="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setUnit(null);
                setFilters({});
                setPage(1);
                setFormError("");
              }}
            >
              清除篩選
            </button>

            <button
              type="button"
              className="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              更新紀錄
            </button>
          </div>
        </form>

        {manager && building && (
          <>
            <p>戶別範圍：{unit?.label ?? "全部戶別"}</p>
            <div className="actions">
              <button
                type="button"
                className="button"
                onClick={() =>
                  setChoosingUnit((value) => !value)
                }
              >
                {choosingUnit ? "收合戶別選擇" : "選擇戶別"}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => selectUnit(null)}
              >
                全部戶別
              </button>
            </div>

            {choosingUnit && (
              <UnitPicker
                buildingId={building.id}
                onSelect={selectUnit}
              />
            )}
          </>
        )}
      </section>

      <Query
        key={JSON.stringify({ filters, page, revision })}
        load={load}
      >
        {(result) => (
          <section className="form-stack" aria-label="簽收紀錄列表">
            {result.items.length === 0 && (
              <PageState
                kind="empty"
                title="這一頁沒有符合條件的簽收紀錄"
              />
            )}

            {result.items.map((receipt) => (
              <article key={receipt.id} className="panel">
                <h2>{receipt.recipient_name}</h2>
                <p>
                  {receipt.building_name}・{receipt.unit_label}
                </p>
                <p>
                  {receipt.courier || "未填物流公司"}・
                  {receipt.tracking_number || "未填單號"}
                </p>
                <p>簽收者：{receipt.picked_up_by_name}</p>
                <p>經手管理員：{receipt.handled_by_name}</p>
                <p>{formatTime(receipt.picked_up_at)}</p>

                <button
                  type="button"
                  className="button"
                  onClick={() => setSelected(receipt)}
                >
                  查看簽收詳情
                </button>
              </article>
            ))}

            <Pagination
              page={page}
              total={result.total}
              pageSize={result.page_size}
              onChange={setPage}
            />
          </section>
        )}
      </Query>

      {selected && (
        <ReceiptModal
          key={selected.id}
          receipt={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: Pickup;
  onClose: () => void;
}) {
  const load = useCallback(
    () =>
      findPickup(
        receipt.parcel_id,
        receipt.occupancy_id,
        undefined,
        receipt.verification_id,
      ),
    [
      receipt.parcel_id,
      receipt.occupancy_id,
      receipt.verification_id,
    ],
  );

  return (
    <Modal title="簽收詳情" onClose={onClose}>
      <Query load={load}>
        {(latest) => (
          <>
            <ReceiptFields receipt={latest} />
            <p className="muted">
              姓名顯示簽收當時保存的值。
              簽收紀錄不提供修改或刪除。
            </p>
          </>
        )}
      </Query>
    </Modal>
  );
}

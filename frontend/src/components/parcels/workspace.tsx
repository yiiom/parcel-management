"use client";

import Link from "next/link";
import {
  useCallback,
  useState,
  type SubmitEvent,
} from "react";
import type { Unit } from "@/api/units";
import {
  getParcels,
  type Parcel,
  type ParcelFilters,
  type ParcelStatus,
} from "@/api/parcels";
import { useAccount } from "@/components/app-frame";
import { UnitPicker } from "@/components/invitations/selectors";
import { Query, formatTime } from "@/components/invitations/shared";
import { PageState, Pagination } from "@/components/ui/common";
import ParcelEditor from "./editor";
import ParcelDetail from "./detail";
import { ParcelSummary, ParcelBadge, parcelStatusNames } from "./view";
import { getResidentExceptions } from "./resident-exceptions";

const dashboardStatuses: ParcelStatus[] = ["pending", "picked_up", "exception"];

function ResidentSummary({ revision }: { revision: number }) {
  const load = useCallback(() => getParcels({ status: "pending" }, 1), []);
  return <Query key={revision} load={load}>{(result) => (
    <section className="resident-parcel-banner" aria-label="待領包裹摘要">
      <h2>目前有 {result.total} 件包裹</h2>
      <p>到管理室提供取件碼，收到實物後再確認簽收。</p>
    </section>
  )}</Query>;
}

function ManagerTotals({ revision, onSelect }: { revision: number; onSelect: (status: ParcelStatus) => void }) {
  const load = useCallback(async () => Promise.all(
    dashboardStatuses.map(async (status) => ({ status, total: (await getParcels({ status }, 1)).total })),
  ), []);
  return <Query key={revision} load={load}>{(totals) => (
    <section className="manager-totals" aria-label="全棟包裹統計">
      {totals.map(({ status, total }) => <button type="button" className="manager-total" key={status} onClick={() => onSelect(status)}>
        <span>{parcelStatusNames[status]}</span><strong>{total}<small> 件包裹</small></strong>
      </button>)}
    </section>
  )}</Query>;
}

export default function ParcelWorkspace({
  exceptionMode = false,
}: {
  exceptionMode?: boolean;
} = {}) {
  const { account, building } = useAccount();
  const manager = account.user.role === "building_admin";

  const [keyword, setKeyword] = useState("");
  // 住戶預設待領取；異常分類合併呈現異常與退回，管理員維持原篩選。
  const [status, setStatus] = useState<ParcelStatus | "">(
    exceptionMode ? "exception" : manager ? "" : "pending",
  );
  const [unit, setUnit] = useState<Unit | null>(null);
  const [choosingUnit, setChoosingUnit] = useState(false);

  const [filters, setFilters] = useState<ParcelFilters>(() =>
    exceptionMode ? { status: "exception" } : manager ? {} : { status: "pending" },
  );
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editor, setEditor] = useState<
    { original: Parcel | null } | null
  >(null);

  const load = useCallback(
    () => !manager && filters.status === "exception"
      ? getResidentExceptions(filters, page)
      : getParcels(filters, page),
    [filters, page, manager],
  );

  const membership = account.memberships.find(
    (item) =>
      item.status === "active" ||
      item.status === "exit_requested",
  );

  // 住戶仍可在一般包裹詳情閱讀異常資料，不能進入管理操作頁。
  if (exceptionMode && !manager) {
    return (
      <PageState
        kind="forbidden"
        title="只有大樓管理員可進入異常處理"
      />
    );
  }

  if (
    account.user.role !== "building_admin" &&
    account.user.role !== "resident"
  ) {
    return (
      <PageState
        kind="forbidden"
        title="此角色不能查看或管理包裹"
      />
    );
  }

  if (manager && !building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  if (!manager && !membership) {
    return (
      <PageState kind="empty" title="目前尚未加入有效入住">
        <Link href="/join">使用邀請碼加入戶別</Link>
      </PageState>
    );
  }

  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setFilters({
      unit_id: manager ? unit?.id : undefined,
      status: status || undefined,
      keyword: keyword.trim() || undefined,
    });
    setPage(1);
    setNotice("");
  }

  function selectUnit(selected: Unit | null) {
    setUnit(selected);
    setChoosingUnit(false);
    setFilters((previous) => ({
      ...previous,
      unit_id: selected?.id,
    }));
    setPage(1);
  }

  function selectStatus(next: ParcelStatus | "") {
    setStatus(next);
    setFilters({ unit_id: unit?.id, status: next || undefined, keyword: keyword.trim() || undefined });
    setPage(1);
    setNotice("");
  }

  function openDetail(id: number) {
    setNotice("");
    setSelectedId(id);
  }

  function closeEditor() {
    const originalId = editor?.original?.id;

    setEditor(null);
    setRevision((value) => value + 1);

    // 更正取消或發生衝突後，重新查詢原包裹詳情。
    if (originalId !== undefined) setSelectedId(originalId);
  }

  function saved(parcel: Parcel) {
    const creating = editor?.original === null;

    setEditor(null);
    setNotice(
      creating
        ? `包裹 #${parcel.id} 已登記。`
        : `包裹 #${parcel.id} 更正已完成。`,
    );

    if (creating) setPage(1);

    setRevision((value) => value + 1);
    setSelectedId(parcel.id);
  }

  const queryKey = JSON.stringify({ filters, page, revision });

  return (
    <main className={manager ? "form-stack manager-parcels" : "form-stack resident-parcels"}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {manager ? building?.name : membership?.building_name}
          </p>
          <h1>
            {exceptionMode
              ? "異常處理"
              : manager
                ? "包裹管理"
                : `${account.user.name}，你好`}
          </h1>

          <p className="muted">
            {exceptionMode
              ? "預設顯示異常處理中的包裹，可切換狀態查詢；只保留最近一次異常及處理結果。"
              : manager
                ? "查看所屬大樓目前及歷史入住的包裹。"
                : `${membership?.building_name}・${membership?.unit_label}／我的包裹`}
          </p>
        </div>

        {manager && !exceptionMode && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setNotice("");
              setEditor({ original: null });
            }}
          >
            登記包裹
          </button>
        )}
      </div>

      {notice && <p className="notice" role="status">{notice}</p>}
      {!manager && <ResidentSummary revision={revision} />}
      {!manager && membership?.status === "exit_requested" && <p className="notice">退出申請處理期間，仍保有目前入住的使用權限。</p>}

      {manager && !exceptionMode && <ManagerTotals revision={revision} onSelect={(next) => {
        setKeyword(""); setUnit(null); setChoosingUnit(false); setStatus(next);
        setFilters({ status: next }); setPage(1); setNotice("");
      }} />}

      <section className="panel form-stack parcel-filter-panel">
        <div className="parcel-status-tabs" aria-label="包裹狀態篩選">
          {(["", "pending", "picked_up", "exception", "returned"] as const).filter((value) => manager || value === "pending" || value === "exception").map((value) => (
            <button type="button" key={value} aria-pressed={(filters.status ?? "") === value} onClick={() => selectStatus(value)}>
              {!manager && value === "exception" ? "異常／退貨" : value ? parcelStatusNames[value] : "全部"}
            </button>
          ))}
        </div>
        <form onSubmit={search} className="form-stack">
          <div className="form-grid">
            <label>
              搜尋包裹
              <input
                type="search"
                value={keyword}
                placeholder="收件人、戶號、物流公司或單號"
                onChange={(event) => setKeyword(event.target.value)}
              />
            </label>

            <label className="manager-status-select">
              包裹狀態
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ParcelStatus | "")
                }
              >
                <option value="">全部狀態</option>
                <option value="pending">待領取</option>
                <option value="picked_up">已簽收</option>
                <option value="exception">異常處理中</option>
                <option value="returned">已退回物流</option>
              </select>
            </label>
          </div>

          <div className="actions">
            <button type="submit" className="button button-primary">
              套用搜尋與狀態
            </button>

            <button
              type="button"
              className="button"
              onClick={() => {
                setKeyword("");
                setStatus(exceptionMode ? "exception" : manager ? "" : "pending");
                setUnit(null);

                // 清除後回到各角色頁面的預設分類。
                setFilters(
                  exceptionMode ? { status: "exception" } : manager ? {} : { status: "pending" },
                );

                setPage(1);
                setNotice("");
              }}
            >
              清除篩選
            </button>

            <button
              type="button"
              className="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              更新列表
            </button>
          </div>
        </form>

        {manager && building && (
          <details className="parcel-unit-filter">
            <summary>戶別篩選：{unit?.label ?? "全部戶別"}</summary>
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
          </details>
        )}
      </section>

      <Query key={queryKey} load={load}>
        {(result) => (
          <section className="form-stack" aria-label="包裹列表">
            <p className="muted">依登記時間由新到舊排列。</p>

            {result.items.length === 0 && (
              <PageState
                kind="empty"
                title="這一頁沒有符合條件的包裹"
              />
            )}

            {manager && result.items.length > 0 && <div className="manager-table-scroll">
              <table className="manager-parcel-table">
                <caption className="sr-only">包裹列表，依登記時間由新到舊排列</caption>
                <thead><tr><th scope="col">收件人／戶別</th><th scope="col">物流／單號</th><th scope="col">登記時間</th><th scope="col">狀態</th><th scope="col">操作</th></tr></thead>
                <tbody>{result.items.map((parcel) => <tr key={parcel.id}>
                  <td><strong>{parcel.recipient_name}</strong><small>{parcel.unit_label} · 包裹 #{parcel.id}</small></td>
                  <td>{parcel.courier || "未填物流公司"}<small>{parcel.tracking_number || "未填單號"}</small></td>
                  <td>{formatTime(parcel.created_at)}</td>
                  <td><ParcelBadge status={parcel.status} />{parcel.status === "pending" && parcel.active_verification_id !== null && <small>等待住戶確認</small>}</td>
                  <td><button className="button button-quiet" type="button" aria-label={`查看包裹 #${parcel.id} 詳情`} onClick={() => openDetail(parcel.id)}>查看</button></td>
                </tr>)}</tbody>
              </table>
            </div>}

            <div className={manager ? "manager-mobile-parcels form-stack" : "resident-parcel-cards"}>
            {result.items.map((parcel) => (
              <article key={parcel.id} className="panel">
                {manager ? <ParcelSummary parcel={parcel} /> : <>
                  <div className="row-between"><h2>{parcel.courier || "未填物流公司"}</h2><ParcelBadge status={parcel.status} /></div>
                  <p>{parcel.recipient_name} · {parcel.unit_label}</p>
                  <p className="muted">物流單號 {parcel.tracking_number || "未填寫"}</p>
                  <p className="muted">登記時間 {formatTime(parcel.created_at)}</p>
                  <small className="muted">包裹 #{parcel.id}</small>
                  {parcel.status === "pending" && parcel.active_verification_id !== null && <p className="muted">等待住戶確認</p>}
                </>}
                <div className="actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => openDetail(parcel.id)}
                  >
                    查看詳情
                  </button>
                </div>
              </article>
            ))}
            </div>

            <Pagination
              page={page}
              total={result.total}
              pageSize={result.page_size}
              onChange={setPage}
            />
          </section>
        )}
      </Query>

      {selectedId !== null && !editor && (
        <ParcelDetail
          key={selectedId}
          parcelId={selectedId}
          manager={manager}
          notice={notice}
          onClose={() => {
              setSelectedId(null);

              // 取件完成、取消或狀態變更後，重新取得列表。
              // 若目前篩選待領取，已簽收包裹會依後端結果移出列表。
              setRevision((value) => value + 1);
          }}
          onEdit={(parcel) => {
            setSelectedId(null);
            setNotice("");
            setEditor({ original: parcel });
          }}
        />
      )}

      {editor && manager && building && (
        <ParcelEditor
          key={editor.original?.id ?? "new"}
          buildingId={building.id}
          original={editor.original}
          onClose={closeEditor}
          onSaved={saved}
        />
      )}
    </main>
  );
}

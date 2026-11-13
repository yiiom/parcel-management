"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createOccupancy, getOccupancies, OccupancyApiError, type OccupancyPage } from "@/api/occupancies";
import { getUnits, type Unit } from "@/api/units";
import { useAccount } from "@/components/app-frame";
import { Badge, PageState, Pagination } from "@/components/ui/common";

// 明確使用臺灣時間，避免不同電腦顯示不同時區
function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間資料異常";

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export default function OccupancyListPage() {
  const { unitId } = useParams<{ unitId: string }>();

  // 切換戶別時重建元件，避免殘留上一戶的資料與頁碼
  return <OccupancyList key={unitId} unitId={unitId} />;
}

function OccupancyList({ unitId }: { unitId: string }) {
  const router = useRouter();
  const { building } = useAccount();
  const buildingId = building?.id;
  const [unit, setUnit] = useState<Unit | null>(null);
  const [hasActive, setHasActive] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<OccupancyPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  // 建立期間鎖定按鈕與分頁，避免重複送出
  const [creating, setCreating] = useState(false);
  // 建立錯誤與列表錯誤分開，避免一般建立失敗時隱藏列表
  const [createError, setCreateError] = useState("");
  // 後端確認建立成功後才顯示
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (buildingId === undefined || !/^[1-9]\d*$/.test(unitId)) return;
    let ignore = false;

    async function loadUnitLabel(id: number) {
      try {
        for (let unitPage = 1; !ignore; unitPage += 1) {
          const data = await getUnits(id, unitPage);
          if (ignore || !data) return;
          const match = data.items.find((item) => item.id === Number(unitId));
          if (match) {
            setUnit(match);
            return;
          }
          if (data.items.length === 0 || unitPage * data.page_size >= data.total) return;
        }
      } catch {
        // 戶別名稱查詢失敗時，入住紀錄仍可獨立載入。
      }
    }

    void loadUnitLabel(buildingId);
    return () => { ignore = true; };
  }, [buildingId, unitId]);

  useEffect(() => {
    // 離開頁面或切換頁碼後，忽略舊請求的回應
    let ignore = false;

    async function loadOccupancies() {
      try {
        const id = Number(unitId);

        // 排除文字、負數、小數及超出安全範圍的 ID
        if (!/^[1-9]\d*$/.test(unitId) || !Number.isSafeInteger(id)) {
          throw new Error("戶別網址不正確。");
        }

        const data = await getOccupancies(id, page);
        if (ignore) return;

        if (data === null) {
          // 登入失效時不顯示入住紀錄，返回登入頁
          router.replace("/login");
          return;
        }

        // 有效入住必為最新一筆，瀏覽歷史頁時仍查第一頁確認。
        const latest = page === 1 ? data : await getOccupancies(id, 1);
        if (ignore) return;
        if (latest === null) {
          router.replace("/login");
          return;
        }
        setHasActive(latest.items.some((item) => item.ended_at === null));
        setResult(data);
      } catch (err) {
        if (ignore) return;

        setError(
          err instanceof TypeError
            ? "無法連線，請確認網路後再試。"
            : err instanceof Error
              ? err.message
              : "無法載入入住紀錄。",
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadOccupancies();
    return () => {
      ignore = true;
    };
  }, [unitId, page, retryCount, router]);

  // 沒有紀錄時，仍顯示第 1 頁／共 1 頁
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.page_size))
    : 1;

  function changePage(nextPage: number) {
    if (
      loading || creating || !result || nextPage < 1 ||
      nextPage > totalPages || nextPage === page
    ) return;

    // 清除舊資料，避免新頁碼配上上一頁的紀錄
    setResult(null);
    setError("");
    setCreateError("");
    setSuccess("");
    setLoading(true);
    setPage(nextPage);
  }

  function retryLoad() {
    if (loading || creating) return;
    setResult(null);
    setError("");
    setCreateError("");
    setLoading(true);
    // 頁碼不變也可以重新發送請求；保留成功訊息，避免誤以為尚未建立
    setRetryCount((count) => count + 1);
  }

  async function handleCreate() {
    if (creating || loading || error || hasActive || !result) return;
    setCreateError("");
    setSuccess("");
    setCreating(true);

    try {
      const created = await createOccupancy(Number(unitId));
      if (created === null) {
        // 登入失效時清除資料，返回登入頁
        setResult(null);
        router.replace("/login");
        return;
      }
      setSuccess("入住已建立。");
      // 新紀錄排在最前面，因此成功後回第一頁重新讀取
      setResult(null);
      setError("");
      setLoading(true);
      setPage(1);
      // 原本就在第一頁時，也要觸發重新讀取
      setRetryCount((count) => count + 1);
    } catch (err) {
      if (err instanceof OccupancyApiError && (err.status === 403 || err.status === 404)) {
        // 權限失效或戶別不存在時，不繼續顯示舊紀錄
        setResult(null);
        setError(err.message);
        return;
      }
      if (err instanceof OccupancyApiError && err.status === 409) {
        setHasActive(true);
      }
      setCreateError(
        err instanceof TypeError
          // 連線中斷時，請求可能已抵達後端，先查列表確認結果
          ? "無法確認建立結果，請確認網路後重新載入列表，再決定是否重試。"
          : err instanceof Error ? err.message : "建立入住失敗。",
      );
    } finally {
      // 成功或失敗都解除建立鎖定
      setCreating(false);
    }
  }

  return (
    <main className="member-directory form-stack">
      {buildingId !== undefined && (
        <div><Link className="text-link" href={`/buildings/${buildingId}/units`}>← 返回戶別列表</Link></div>
      )}

      {success && <p className="notice" role="status">{success}</p>}
      {success && error && (
        <p>入住已建立，但列表尚未更新。請按「重新載入」，勿重複建立。</p>
      )}
      {loading && <PageState kind="loading" title="正在載入入住紀錄…" />}
      {error && (
        <div className="panel form-stack">
          <p className="error-text" role="alert">{error}</p>
          <div className="actions">
            <button type="button" className="button" onClick={retryLoad} disabled={loading || creating}>重新載入</button>
          </div>
        </div>
      )}

      {!loading && !error && result && (
        <>
          <div className="row-between">
            <div>
              <h1>{unit ? `${unit.label}・入住紀錄` : "入住紀錄"}</h1>
              <p id="occupancy-create-help" className="muted">
                {hasActive ? "此戶目前有有效入住，結束後才能建立下一次入住。" : "建立入住後，開始時間由系統記錄。"}
              </p>
            </div>
            <button
              type="button"
              className="button button-primary"
              aria-describedby="occupancy-create-help"
              onClick={() => void handleCreate()}
              disabled={creating || hasActive}
            >
              {creating ? "建立中…" : "＋ 建立入住"}
            </button>
          </div>

          {createError && (
            <div className="actions">
              <p className="error-text" role="alert">{createError}</p>
              <button type="button" className="button" onClick={retryLoad} disabled={creating}>重新載入列表</button>
            </div>
          )}

          {result.items.length === 0 ? (
            <PageState kind="empty" title="目前沒有入住紀錄" />
          ) : (
            <table className="member-table occupancy-table" role="table" aria-label="入住紀錄">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">狀態</th>
                  <th scope="col" role="columnheader">開始時間</th>
                  <th scope="col" role="columnheader">結束時間</th>
                  <th scope="col" role="columnheader">操作</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {result.items.map((occupancy) => (
                  <tr key={occupancy.id} role="row">
                    <th scope="row" role="rowheader">
                      <Badge tone={occupancy.ended_at ? "gray" : "green"}>
                        {occupancy.ended_at ? "已結束" : "目前入住"}
                      </Badge>
                    </th>
                    <td role="cell">
                      <span className="member-field-label" aria-hidden="true">開始時間：</span>
                      {formatTime(occupancy.started_at)}
                    </td>
                    <td role="cell">
                      <span className="member-field-label" aria-hidden="true">結束時間：</span>
                      {occupancy.ended_at ? formatTime(occupancy.ended_at) : "尚未結束"}
                    </td>
                    <td role="cell">
                      <Link
                        href={`/move-outs/end?unit=${unitId}&occupancy=${occupancy.id}`}
                        className={occupancy.ended_at ? "button" : "button occupancy-end-action"}
                      >
                        {occupancy.ended_at ? "查看結束結果" : "檢查並結束此入住"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 ? (
            <Pagination page={page} total={result.total} pageSize={result.page_size} onChange={changePage} />
          ) : (
            <p className="muted">共 {result.total} 筆入住紀錄</p>
          )}
        </>
      )}
    </main>
  );
}

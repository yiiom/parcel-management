"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createOccupancy, getOccupancies, OccupancyApiError, type OccupancyPage } from "@/api/occupancies";

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
    if (creating || loading || error || !result) return;
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
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">入住紀錄列表</h1>
      <Link href="/workspace/building_admin" className="mt-4 inline-block text-teal-700 underline">
        返回大樓管理員首頁
      </Link>

      {success && <p className="mt-4 text-teal-700" role="status">{success}</p>}
      {/* 建立與刷新分開處理，刷新失敗不代表建立失敗 */}
      {success && error && (
        <p className="mt-2">入住已建立，但列表尚未更新。請按「重新載入」，勿重複建立。</p>
      )}
      {loading && <p className="mt-4" role="status">正在載入入住紀錄…</p>}
      {error && (
        <div className="mt-4">
          <p className="text-red-600" role="alert">{error}</p>
          <button type="button" onClick={retryLoad} disabled={loading || creating}
            className="mt-3 rounded border px-4 py-2 disabled:opacity-50">
            重新載入
          </button>
        </div>
      )}

      {/* 成功取得資料後，才顯示列表與分頁 */}
      {!loading && !error && result && (
        <>
          <section className="mt-6 rounded border p-4" aria-labelledby="create-occupancy">
            <h2 id="create-occupancy" className="text-xl font-bold">建立入住</h2>
            <p className="mt-2">
              為此戶建立新的入住，開始時間由系統記錄。
              同戶已有有效入住時，須先結束原入住才能建立下一次入住。
            </p>
            {createError && <p className="mt-3 text-red-600" role="alert">{createError}</p>}
            {/* 後端會再次檢查唯一性，不能只依目前這一頁判斷 */}
            <button type="button" onClick={handleCreate} disabled={creating || loading}
              className="mt-4 rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50">
              {creating ? "建立中…" : "建立入住"}
            </button>
            {/* 連線失敗或重複入住後，可重新讀取最新狀態 */}
            {createError && (
              <button type="button" onClick={retryLoad} disabled={creating || loading}
                className="ml-3 mt-4 rounded border px-4 py-2 disabled:opacity-50">
                重新載入列表
              </button>
            )}
          </section>
          <p className="mt-6">共 {result.total} 筆入住紀錄</p>
          <p className="mt-2 text-sm">依建立順序由新到舊排列，時間以臺灣時間顯示。</p>
          {result.items.length === 0 ? (
            <p className="mt-4">目前沒有入住紀錄。</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {result.items.map((occupancy) => (
                <li key={occupancy.id} className="rounded border p-4">
                  {/* 以 ended_at 判斷狀態，不以所在頁碼推定 */}
                  <h2 className="font-bold">
                    {occupancy.ended_at === null ? "目前入住" : "歷史入住（已結束）"}
                  </h2>
                  <p className="mt-2">開始時間：{formatTime(occupancy.started_at)}</p>
                  <p className="mt-2">
                    結束時間：{occupancy.ended_at === null ? "尚未結束" : formatTime(occupancy.ended_at)}
                  </p>
                  {/* 指定原入住，避免誤把新入住當成要結束的對象。 */}
                  <Link
                    href={
                      `/move-outs/end?unit=${unitId}` +
                      `&occupancy=${occupancy.id}`
                    }
                    className="button mt-4"
                  >
                    {occupancy.ended_at === null
                      ? "檢查並結束此入住"
                      : "查看此入住的結束結果"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="入住紀錄分頁" className="mt-6 flex items-center justify-between gap-4">
            <button type="button" onClick={() => changePage(page - 1)}
              disabled={loading || creating || page <= 1} className="rounded border px-4 py-2 disabled:opacity-50">
              上一頁
            </button>
            <p aria-live="polite">第 {result.page} 頁／共 {totalPages} 頁</p>
            <button type="button" onClick={() => changePage(page + 1)}
              disabled={loading || creating || page >= totalPages} className="rounded border px-4 py-2 disabled:opacity-50">
              下一頁
            </button>
          </nav>
        </>
      )}
    </main>
  );
}

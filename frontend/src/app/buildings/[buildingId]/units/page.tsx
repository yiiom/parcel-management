"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createUnit, getUnits, updateUnit, UnitApiError, type Unit, type UnitPage } from "@/api/units";

export default function UnitListPage() {
  // 從網址讀取大樓 ID
  const { buildingId } = useParams<{ buildingId: string }>();

  // 換大樓時重建元件，避免殘留上一棟的資料與頁碼
  return <UnitList key={buildingId} buildingId={buildingId} />;
}

function UnitList({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1); // 要載入的頁碼
  const [result, setResult] = useState<UnitPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // 表單內容與送出狀態
  const [floor, setFloor] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [saving, setSaving] = useState(false);
  // 表單錯誤獨立保存，避免新增失敗時隱藏整個列表
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  // 同一時間只編輯一筆戶別；null 代表沒有正在編輯
  const [editingId, setEditingId] = useState<number | null>(null);
  // 編輯欄位與新增欄位分開，避免互相覆蓋
  const [editFloor, setEditFloor] = useState("");
  const [editUnitNumber, setEditUnitNumber] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    // 離開頁面後，忽略尚未完成的請求結果
    let ignore = false;

    async function loadUnits() {
      try {
        const id = Number(buildingId);

        // 排除 abc、負數、小數及超出安全範圍的 ID
        if (!/^[1-9]\d*$/.test(buildingId) || !Number.isSafeInteger(id)) {
          throw new Error("大樓網址不正確。");
        }

        const data = await getUnits(id, page);
        if (ignore) return;

        if (data === null) {
          // 沒有有效登入時，不顯示戶別資料
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
              : "無法載入戶別列表。",
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadUnits();
    return () => {
      ignore = true;
    };
  }, [buildingId, page, retryCount, router]);

  // 空列表也顯示第 1 頁／共 1 頁
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.page_size))
    : 1;

  function changePage(nextPage: number) {
    // 載入中、超出範圍或同一頁時，不重複發送請求
    if (
      loading || saving || editingId !== null || !result || nextPage < 1 ||
      nextPage > totalPages || nextPage === page
    ) return;

    // 先清除舊列表，避免新頁碼配上上一頁資料
    setSuccess("");
    setResult(null);
    setError("");
    setLoading(true);
    setPage(nextPage);
  }

  function retryLoad() {
    if (loading || saving) return;
    setResult(null);
    setError("");
    setLoading(true);
    // 改變計數，讓 useEffect 重新讀取目前頁碼
    setRetryCount((count) => count + 1);
  }

  async function handleCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); // 不讓瀏覽器重新整理整個頁面
    if (saving || loading || !result || editingId !== null) return;
    setFormError("");
    setSuccess("");

    // 與後端一致：先去除首尾空白，再計算 Unicode 字元數
    const floorLength = Array.from(floor.trim()).length;
    const unitNumberLength = Array.from(unitNumber.trim()).length;
    if (floorLength < 1 || floorLength > 20) {
      setFormError("樓層須為 1～20 個字元，不能只有空白。");
      return;
    }
    if (unitNumberLength < 1 || unitNumberLength > 20) {
      setFormError("戶號須為 1～20 個字元，不能只有空白。");
      return;
    }

    setSaving(true);
    try {
      const created = await createUnit(Number(buildingId), {
        floor,
        unit_number: unitNumber,
      });
      if (created === null) {
        // 登入失效時清除列表及表單顯示，返回登入頁
        setResult(null);
        router.replace("/login");
        return;
      }

      // 只有後端確認新增成功，才清空輸入
      setFloor("");
      setUnitNumber("");
      setSuccess("戶別已新增。");
      // 清除舊列表並回第一頁，讓 useEffect 重新載入
      setResult(null);
      setError("");
      setLoading(true);
      setPage(1);
      // 即使原本就在第一頁，也必須觸發重新讀取
      setRetryCount((count) => count + 1);
    } catch (err) {
      if (err instanceof UnitApiError && err.status === 403) {
        // 分配可能已被取消；後端拒絕後不再顯示舊資料
        setResult(null);
        setError(err.message);
        return;
      }
      // 重複戶號或連線失敗時保留輸入，讓使用者修正或重試
      setFormError(
        err instanceof TypeError
          ? "無法連線，請確認網路後再試。"
          : err instanceof Error
            ? err.message
            : "新增戶別失敗。",
      );
    } finally {
      setSaving(false); // 成功或失敗都解除送出鎖定
    }
  }

  function startEdit(unit: Unit) {
    if (saving || loading || editingId !== null) return;
    // 將目前資料複製到編輯表單
    setEditingId(unit.id);
    setEditFloor(unit.floor);
    setEditUnitNumber(unit.unit_number);
    setEditError("");
    setFormError("");
    setSuccess("");
  }

  function cancelEdit() {
    if (saving) return;
    // 只清除編輯草稿，不呼叫後端，也不改列表資料
    setEditingId(null);
    setEditFloor("");
    setEditUnitNumber("");
    setEditError("");
  }

  async function handleUpdate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || !result || editingId === null) return;
    // 確認正在編輯的戶別仍在目前列表中
    if (!result.items.some((unit) => unit.id === editingId)) return;
    setEditError("");
    setSuccess("");

    // 與新增及後端採用相同的字元計算方式
    const floorLength = Array.from(editFloor.trim()).length;
    const numberLength = Array.from(editUnitNumber.trim()).length;
    if (floorLength < 1 || floorLength > 20) {
      setEditError("樓層須為 1～20 個字元，不能只有空白。");
      return;
    }
    if (numberLength < 1 || numberLength > 20) {
      setEditError("戶號須為 1～20 個字元，不能只有空白。");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUnit(editingId, {
        floor: editFloor,
        unit_number: editUnitNumber,
      });
      if (updated === null) {
        // 登入失效時清除資料與編輯表單，返回登入頁
        setResult(null);
        setEditingId(null);
        router.replace("/login");
        return;
      }

      // 使用後端回傳資料替換這一筆，不改變頁碼與列表總數
      setResult((current) => current ? {
        ...current,
        items: current.items.map((unit) => unit.id === updated.id ? updated : unit),
      } : null);
      setEditingId(null);
      setEditFloor("");
      setEditUnitNumber("");
      setSuccess("戶別資料已更新。");
    } catch (err) {
      if (err instanceof UnitApiError && (err.status === 403 || err.status === 404)) {
        // 權限已失效或資料不存在時，不繼續顯示舊列表
        setResult(null);
        setEditingId(null);
        setError(err.message);
        return;
      }
      // 重複戶號或斷線時保留編輯內容，方便修正或重試
      setEditError(
        err instanceof TypeError ? "無法連線，請確認網路後再試。"
          : err instanceof Error ? err.message : "修改戶別失敗。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">戶別列表</h1>
      <Link
        href="/workspace/building_admin"
        className="mt-4 inline-block text-teal-700 underline"
      >
        返回大樓管理員首頁
      </Link>

      {/* 即使新增後列表刷新失敗，仍保留新增成功的訊息 */}
      {success && <p className="mt-4 text-teal-700" role="status">{success}</p>}
      {/* 新增成功與列表刷新是兩件事，避免誤以為需要再次新增 */}
      {success === "戶別已新增。" && error && (
        <p className="mt-2">
          戶別已建立，但列表尚未更新。請按「重新載入」，勿重複新增。
        </p>
      )}
      {loading && <p className="mt-4" role="status">正在載入戶別列表…</p>}

      {error && (
        <div className="mt-4">
          <p className="text-red-600" role="alert">{error}</p>
          <button
            type="button"
            onClick={retryLoad}
            disabled={loading || saving}
            className="mt-3 rounded border px-4 py-2 disabled:opacity-50"
          >
            重新載入
          </button>
        </div>
      )}

      {/* 只有成功取得資料時，才顯示總數、列表與分頁 */}
      {!loading && !error && result && (
        <>
          <form onSubmit={handleCreate} noValidate className="mt-6 rounded border p-4">
            <h2 className="text-xl font-bold">新增戶別</h2>
            {formError && <p className="mt-4 text-red-600" role="alert">{formError}</p>}
            {/* 送出期間停用整份表單，避免修改或重複送出 */}
            <fieldset disabled={saving || editingId !== null} className="mt-4 space-y-4">
              <div>
                <label htmlFor="unit-floor" className="block">樓層（必填，1～20 個字元）</label>
                <input
                  id="unit-floor" name="floor" type="text" required
                  value={floor} onChange={(event) => setFloor(event.target.value)}
                  placeholder="例如 B1、3F" className="mt-2 w-full rounded border p-3"
                />
              </div>
              <div>
                <label htmlFor="unit-number" className="block">戶號（必填，1～20 個字元）</label>
                <input
                  id="unit-number" name="unit_number" type="text" required
                  value={unitNumber} onChange={(event) => setUnitNumber(event.target.value)}
                  placeholder="例如 301、3A" className="mt-2 w-full rounded border p-3"
                />
              </div>
              <button type="submit" className="w-full rounded bg-teal-700 p-3 text-white disabled:cursor-not-allowed disabled:opacity-50">
                {/* 只有新增送出時才顯示「新增中…」 */}
                {saving && editingId === null ? "新增中…" : "新增戶別"}
              </button>
            </fieldset>
          </form>
          <p className="mt-6">共 {result.total} 戶</p>
          {result.items.length === 0 ? (
            <p className="mt-4">目前沒有戶別資料。</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {result.items.map((unit) => (
                <li key={unit.id} className="rounded border p-4">
                  {editingId === unit.id ? (
                    <form onSubmit={handleUpdate} noValidate>
                      {/* 標題顯示原戶號，方便辨識正在修改哪一筆 */}
                      <h2 className="font-bold">修改戶別：{unit.unit_number}</h2>
                      {editError && <p className="mt-3 text-red-600" role="alert">{editError}</p>}
                      <fieldset disabled={saving} className="mt-4 space-y-4">
                        <div>
                          <label htmlFor={`edit-floor-${unit.id}`} className="block">修改樓層（必填，1～20 個字元）</label>
                          <input
                            id={`edit-floor-${unit.id}`} name="floor" type="text" required
                            value={editFloor} onChange={(event) => setEditFloor(event.target.value)}
                            className="mt-2 w-full rounded border p-3"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-number-${unit.id}`} className="block">修改戶號（必填，1～20 個字元）</label>
                          <input
                            id={`edit-number-${unit.id}`} name="unit_number" type="text" required
                            value={editUnitNumber} onChange={(event) => setEditUnitNumber(event.target.value)}
                            className="mt-2 w-full rounded border p-3"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50">
                            {saving ? "儲存中…" : "儲存修改"}
                          </button>
                          {/* type="button" 避免取消時意外送出表單 */}
                          <button type="button" onClick={cancelEdit} className="rounded border px-4 py-2 disabled:opacity-50">
                            取消修改
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  ) : (
                    <>
                      <h2 className="font-bold">戶號：{unit.unit_number}</h2>
                      <p className="mt-2">樓層：{unit.floor}</p>
                      <button
                        type="button" onClick={() => startEdit(unit)}
                        disabled={saving || editingId !== null}
                        aria-label={`修改戶別 ${unit.unit_number}`}
                        className="mt-3 rounded border px-4 py-2 disabled:opacity-50"
                      >修改</button>
                      {/* 從所選戶別開啟入住紀錄；編輯期間先隱藏導覽入口 */}
                      {!saving && editingId === null && (
                        <Link
                          href={`/units/${unit.id}/occupancies`}
                          aria-label={`查看戶別 ${unit.unit_number} 的入住紀錄`}
                          className="ml-3 inline-block text-teal-700 underline"
                        >
                          查看入住紀錄
                        </Link>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <nav
            aria-label="戶別列表分頁"
            className="mt-6 flex items-center justify-between gap-4"
          >
            <button
              type="button"
              onClick={() => changePage(page - 1)}
              disabled={loading || saving || editingId !== null || page <= 1}
              className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一頁
            </button>
            <p aria-live="polite">第 {result.page} 頁／共 {totalPages} 頁</p>
            <button
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={loading || saving || editingId !== null || page >= totalPages}
              className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一頁
            </button>
          </nav>
        </>
      )}
    </main>
  );
}

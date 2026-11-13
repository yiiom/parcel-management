"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createUnit, getUnits, updateUnit, UnitApiError, type Unit, type UnitPage } from "@/api/units";
import { Modal, PageState, Pagination } from "@/components/ui/common";

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
  const [creating, setCreating] = useState(false);
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
        setCreating(false);
        router.replace("/login");
        return;
      }

      // 只有後端確認新增成功，才清空輸入
      setFloor("");
      setUnitNumber("");
      setCreating(false);
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
        setCreating(false);
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
    if (saving || loading || creating || editingId !== null) return;
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

  function closeCreate() {
    if (saving) return;
    setCreating(false);
    setFloor("");
    setUnitNumber("");
    setFormError("");
  }

  const editingUnit = result?.items.find((unit) => unit.id === editingId);

  return (
    <main className="member-directory form-stack">
      {success && <p className="notice" role="status">{success}</p>}
      {success === "戶別已新增。" && error && (
        <p>戶別已建立，但列表尚未更新。請按「重新載入」，勿重複新增。</p>
      )}
      {loading && <PageState kind="loading" title="正在載入戶別列表…" />}

      {error && (
        <div className="panel form-stack">
          <p className="error-text" role="alert">{error}</p>
          <div className="actions">
            <button type="button" className="button" onClick={retryLoad} disabled={loading || saving}>
              重新載入
            </button>
          </div>
        </div>
      )}

      {!loading && !error && result && (
        <>
          <div className="row-between">
            <p className="muted">共 {result.total} 戶</p>
            <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
              ＋ 新增戶別
            </button>
          </div>

          {result.items.length === 0 ? (
            <PageState kind="empty" title="目前沒有戶別資料" />
          ) : (
            <table className="member-table unit-table" role="table" aria-label="戶別列表">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">戶號</th>
                  <th scope="col" role="columnheader">樓層</th>
                  <th scope="col" role="columnheader">操作</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {result.items.map((unit) => (
                  <tr key={unit.id} role="row">
                    <th scope="row" role="rowheader">
                      <span className="member-field-label" aria-hidden="true">戶號：</span>
                      {unit.unit_number}
                    </th>
                    <td role="cell">
                      <span className="member-field-label" aria-hidden="true">樓層：</span>
                      {unit.floor}
                    </td>
                    <td role="cell">
                      <div className="actions unit-row-actions">
                        <Link
                          href={`/units/${unit.id}/occupancies`}
                          aria-label={`查看戶別 ${unit.unit_number} 的入住紀錄`}
                          className="button"
                        >
                          查看入住紀錄
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(unit)}
                          aria-label={`修改戶別 ${unit.unit_number}`}
                          className="button"
                        >
                          修改
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <Pagination page={page} total={result.total} pageSize={result.page_size} onChange={changePage} />
          )}
        </>
      )}

      {creating && (
        <Modal title="新增戶別" onClose={closeCreate}>
          <form onSubmit={handleCreate} noValidate className="form-stack unit-editor">
            {formError && <p className="error-text" role="alert">{formError}</p>}
            <fieldset disabled={saving} className="form-stack">
              <UnitFields floor={floor} unitNumber={unitNumber} onFloorChange={setFloor} onNumberChange={setUnitNumber} />
              <div className="actions unit-editor-actions">
                <button type="button" className="button" onClick={closeCreate}>取消</button>
                <button type="submit" className="button button-primary">{saving ? "新增中…" : "新增戶別"}</button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}

      {editingUnit && (
        <Modal title={`修改戶別：${editingUnit.unit_number}`} onClose={cancelEdit}>
          <form onSubmit={handleUpdate} noValidate className="form-stack unit-editor">
            {editError && <p className="error-text" role="alert">{editError}</p>}
            <fieldset disabled={saving} className="form-stack">
              <UnitFields floor={editFloor} unitNumber={editUnitNumber} onFloorChange={setEditFloor} onNumberChange={setEditUnitNumber} />
              <div className="actions unit-editor-actions">
                <button type="button" className="button" onClick={cancelEdit}>取消修改</button>
                <button type="submit" className="button button-primary">{saving ? "儲存中…" : "儲存修改"}</button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </main>
  );
}

function UnitFields({
  floor,
  unitNumber,
  onFloorChange,
  onNumberChange,
}: {
  floor: string;
  unitNumber: string;
  onFloorChange: (value: string) => void;
  onNumberChange: (value: string) => void;
}) {
  return (
    <div className="form-grid">
      <label>
        樓層（必填，1～20 個字元）
        <input name="floor" type="text" required value={floor} onChange={(event) => onFloorChange(event.target.value)} placeholder="例如 B1、3F" />
      </label>
      <label>
        戶號（必填，1～20 個字元）
        <input name="unit_number" type="text" required value={unitNumber} onChange={(event) => onNumberChange(event.target.value)} placeholder="例如 301、3A" />
      </label>
    </div>
  );
}

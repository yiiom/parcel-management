"use client"; // 這個頁面需要狀態與瀏覽器端資料讀取，因此使用 Client Component

import { useEffect, useState, type SubmitEvent } from "react"; // 管理載入流程、畫面狀態與表單送出事件型別
import Link from "next/link"; // 提供頁面之間的導覽連結
import { useRouter } from "next/navigation"; // 用程式控制跳轉頁面
import {
  getBuildingAdmins, // 呼叫管理員列表 API 的函式
  createBuildingAdmin, // 建立管理員帳號並分配大樓
  assignExistingBuildingAdmin, // 將既有管理員分配到指定大樓
  unassignBuildingAdmin, // 呼叫取消分配 API
  type AdminDirectoryEntry, // 單筆管理員資料，供事件函式使用
  type AdminDirectoryPage, // 後端回傳的管理員分頁資料型別
} from "@/api/building-admins";
import { getBuildings, type Building } from "@/api/buildings"; // 取得選單需要的大樓資料
import { Modal } from "@/components/ui/common";

export default function BuildingAdminsPage() {
  const router = useRouter(); // 取得頁面導覽工具

  // 初始尚未取得資料，因此使用 null
  const [result, setResult] = useState<AdminDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true); // 控制「載入中」提示
  const [error, setError] = useState(""); // 儲存錯誤訊息，空字串代表沒有錯誤
  const [buildings, setBuildings] = useState<Building[]>([]); // 大樓選單的選項
  const [buildingId, setBuildingId] = useState(""); // 選中的大樓 ID；選單值是字串
  const [name, setName] = useState(""); // 管理員姓名
  const [email, setEmail] = useState(""); // 管理員登入 Email
  const [phone, setPhone] = useState(""); // 管理員電話
  const [password, setPassword] = useState(""); // 登入密碼
  const [confirmPassword, setConfirmPassword] = useState(""); // 確認密碼，只在前端比對
  const [saving, setSaving] = useState(false); // 控制建立期間的按鈕與欄位
  const [creating, setCreating] = useState(false);
  const [assignmentAdminId, setAssignmentAdminId] = useState<number | null>(null);
  // 記錄正在取消分配的帳號 ID；null 代表目前沒有取消操作
  const [unassigningUserId, setUnassigningUserId] =
    useState<number | null>(null);
  // 每位管理員各自記住選中的大樓，避免不同卡片共用同一個選項
  const [assignmentSelections, setAssignmentSelections] =
    useState<Record<number, string>>({});
  // 記錄正在分配的管理員，用來顯示「分配中…」
  const [assigningUserId, setAssigningUserId] =
    useState<number | null>(null);
  // 建立、取消或分配期間，都停用其他操作與分頁
  const busy = saving || unassigningUserId !== null || assigningUserId !== null;
  const [success, setSuccess] = useState(""); // 建立成功的提示
  const [page, setPage] = useState(1); // 目前查詢的頁碼，預設第一頁
  const assignmentAdmin = result?.items.find((admin) => admin.user_id === assignmentAdminId);
  // 沒有資料時仍顯示共 1 頁
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.page_size))
    : 1;

  useEffect(() => {
    let ignore = false; // 頁面離開後，忽略尚未完成的請求結果

    async function loadAdmins() {
      try {
        // 兩份資料互不依賴，同時查詢，避免先等名單才開始載入大樓。
        const [adminResult, buildingResult] = await Promise.allSettled([
          getBuildingAdmins(page),
          getBuildings(1),
        ]);

        if (ignore) return; // 如果頁面已離開，就不再更新畫面

        if ((adminResult.status === "fulfilled" && adminResult.value === null) ||
            (buildingResult.status === "fulfilled" && buildingResult.value === null)) {
          setResult(null);
          router.replace("/login"); // 沒有有效登入，跳回登入頁
          return; // 結束函式，不繼續設定列表
        }

        if (adminResult.status === "rejected") throw adminResult.reason;
        if (buildingResult.status === "rejected") throw buildingResult.reason;
        const data = adminResult.value;
        const firstBuildingPage = buildingResult.value;
        if (!data || !firstBuildingPage) return;

        setResult(data); // 將 API 回傳資料存入狀態，讓畫面顯示列表

        // 第一頁已同時取得，其餘頁面仍完整查詢，不省略任何大樓。
        // 大樓 API 有分頁，因此逐頁讀取，避免選單只有前 20 棟。
        const allBuildings: Building[] = [];
        let buildingPage = 1;

        while (true) {
          const buildingData = buildingPage === 1
            ? firstBuildingPage
            : await getBuildings(buildingPage);

          if (ignore) return; // 頁面已離開，就不繼續讀取或更新畫面

          if (buildingData === null) {
            setResult(null); // 登入失效時清除已取得的管理員列表
            router.replace("/login");
            return;
          }

          allBuildings.push(...buildingData.items); // 合併這一頁的大樓資料

          // 已讀到最後一頁，就結束迴圈
          if (
            buildingData.page * buildingData.page_size >= buildingData.total
          ) {
            break;
          }

          buildingPage += 1; // 繼續讀取下一頁
        }

        setBuildings(allBuildings); // 全部成功讀取後，才更新選單資料
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof TypeError
              ? "無法連線，請確認網路後再試。" // fetch 連線失敗時的提示
              : err instanceof Error
                ? err.message // 顯示 API 函式拋出的錯誤，例如無權限
                : "無法載入管理員列表。", // 無法辨識錯誤時的備用提示
          );
        }
      } finally {
        // 無論成功或失敗，請求結束後都停止顯示載入中
        if (!ignore) setLoading(false);
      }
    }

    loadAdmins(); // 執行上方定義的非同步函式

    return () => {
      ignore = true; // 清理時標記忽略結果；不會取消請求本身
    };
  }, [page, router]); // 頁碼改變時，重新讀取管理員列表與大樓選單

  function changePage(nextPage: number) {
    // 載入中、建立中或沒有列表資料時，不接受切頁
    if (loading || busy || !result) return;
    // 不允許超出頁數，也不重複查詢目前頁面
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;

    setAssignmentAdminId(null);
    setLoading(true); // 立即顯示載入提示
    setResult(null); // 清除舊名單，避免新頁碼搭配舊資料
    setError("");
    setSuccess("");
    setPage(nextPage); // 觸發 useEffect，保留尚未送出的表單輸入
  }

  async function handleAssign(admin: AdminDirectoryEntry) {
    // 載入中或其他操作進行中，不接受新的分配請求
    if (loading || busy || !result) return;
    setError("");
    setSuccess("");

    // 已分配者必須先取消原分配，不能直接覆蓋
    if (admin.building_id !== null) {
      setError("請先取消原大樓分配，再選擇新的大樓。");
      return;
    }
    // 讀取這位管理員卡片的選項，轉換成數字 ID
    const selectedId = Number(assignmentSelections[admin.user_id] ?? "");
    // 只能選擇已載入的大樓；實際權限與一人一棟規則仍由後端檢查
    const selectedBuilding = buildings.find((building) => building.id === selectedId);
    if (!Number.isSafeInteger(selectedId) || !selectedBuilding) {
      setError("請選擇要分配的大樓。");
      return;
    }
    setAssigningUserId(admin.user_id); // 鎖定操作並顯示分配中
    try {
      const assigned = await assignExistingBuildingAdmin(selectedId, admin.user_id);
      if (assigned === null) {
        // 登入失效時清除列表與密碼，再返回登入頁
        setResult(null);
        setPassword("");
        setConfirmPassword("");
        router.replace("/login");
        return;
      }
      // 後端確認成功後，才更新該管理員的負責大樓
      // 這是分配既有帳號，因此總人數與目前頁碼保持不變
      setResult((current) => current === null ? null : {
        ...current,
        items: current.items.map((item) => item.user_id === admin.user_id
          ? { ...item, building_id: assigned.building_id, building_name: selectedBuilding.name }
          : item),
      });
      // 只清除這位管理員的選項，保留其他卡片尚未送出的選擇
      setAssignmentSelections((current) => {
        const next = { ...current };
        delete next[admin.user_id];
        return next;
      });
      setSuccess(`已將「${admin.name}」分配至「${selectedBuilding.name}」。`);
      setAssignmentAdminId(null);
      // 分配成功與刷新列表分開處理，避免誤報分配失敗
      try {
        const latest = await getBuildingAdmins(page);
        if (latest === null) {
          setResult(null);
          setPassword("");
          setConfirmPassword("");
          router.replace("/login");
          return;
        }
        setResult(latest); // 以後端最新資料更新目前頁
      } catch {
        setResult(null); // 不繼續顯示無法確認是否最新的列表
        setError("大樓已分配，但列表更新失敗，請重新整理查看，勿重複分配。");
      }
    } catch (err) {
      // 分配失敗時保留選項，讓使用者修正或稍後再試
      setError(err instanceof Error ? err.message : "分配大樓失敗，請稍後再試。");
    } finally {
      setAssigningUserId(null); // 成功或失敗都解除操作鎖定
    }
  }

  async function handleUnassign(admin: AdminDirectoryEntry) {
    // 載入中、其他操作進行中或尚未取得列表時，不接受操作
    if (loading || busy || !result) return;
    // 未分配的管理員沒有需要解除的關係
    if (admin.building_id === null) return;

    // 只有正在確認的管理員，才允許送出取消請求
    if (assignmentAdminId !== admin.user_id) return;
    // 以目前列表再次核對，避免操作已過時的分配資料
    const currentAdmin = result.items.find((item) => item.user_id === admin.user_id);
    if (!currentAdmin || currentAdmin.building_id === null ||
        currentAdmin.building_id !== admin.building_id) {
      setAssignmentAdminId(null);
      return;
    }

    setUnassigningUserId(admin.user_id); // 顯示該筆的「取消中…」
    setError(""); // 清除前一次錯誤
    setSuccess(""); // 清除前一次成功訊息

    try {
      const cancelled = await unassignBuildingAdmin(
        admin.building_id,
        admin.user_id,
      );
      if (cancelled === null) {
        // 登入失效：清除名單及密碼，交由登入頁重新驗證
        setResult(null);
        setPassword("");
        setConfirmPassword("");
        router.replace("/login");
        return;
      }

      // 後端確認成功後，才更新畫面上的分配狀態
      // 取消分配不刪除帳號，因此保留總人數及頁碼
      setResult((current) =>
        current === null
          ? null
          : {
              ...current,
              items: current.items.map((item) =>
                item.user_id === admin.user_id
                  ? { ...item, building_id: null, building_name: null }
                  : item,
              ),
            },
      );
      setSuccess(`已取消「${admin.name}」的大樓分配。`);
      setAssignmentAdminId(null);

      // 再讀取目前頁，與後端最新資料同步
      // 另開一層 try，避免刷新失敗被誤報為取消失敗
      try {
        const latest = await getBuildingAdmins(page);
        if (latest === null) {
          setResult(null);
          setPassword("");
          setConfirmPassword("");
          router.replace("/login");
          return;
        }
        setResult(latest);
      } catch {
        setResult(null); // 無法確認最新資料時，不繼續顯示名單
        setError("分配已取消，但列表更新失敗，請重新整理查看，勿重複取消。");
      }
    } catch (err) {
      // API 失敗時保留原列表；不提前顯示「尚未分配」
      setError(
        err instanceof Error
          ? err.message // 包含 API 函式已轉換的中文連線錯誤
          : "取消管理員分配失敗，請稍後再試。",
      );
    } finally {
      setUnassigningUserId(null); // 成功或失敗都解除操作鎖定
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); // 避免送出表單時重新整理頁面

    if (busy || loading || !result) return; // 載入中或送出中時不接受操作

    setError(""); // 清除上一次的錯誤
    setSuccess(""); // 清除上一次的成功訊息

    const selectedId = Number(buildingId); // 選單字串轉成數字 ID

    // 必須選擇已載入的大樓；真正的操作權限仍由後端檢查
    if (
      !Number.isSafeInteger(selectedId) ||
      !buildings.some((building) => building.id === selectedId)
    ) {
      setError("請選擇要分配的大樓。");
      return;
    }

    const nameLength = Array.from(name.trim()).length; // 去除頭尾空白後計算字元
    const phoneLength = Array.from(phone.trim()).length;
    const passwordLength = Array.from(password).length; // 密碼保持原樣，不去除空白
    const trimmedEmail = email.trim();

    if (nameLength < 1 || nameLength > 100) {
      setError("姓名須為 1～100 個字元，不能只有空白。");
      return;
    }

    // 先檢查必填與長度；完整 Email 格式由後端驗證
    if (!trimmedEmail || Array.from(trimmedEmail).length > 255) {
      setError("請填寫 Email，且不得超過 255 個字元。");
      return;
    }

    if (phoneLength < 8 || phoneLength > 20) {
      setError("管理員聯絡電話須為 8～20 個字元。");
      return;
    }

    if (passwordLength < 8 || passwordLength > 128) {
      setError("密碼須為 8～128 個字元。");
      return;
    }

    // 先確認有填寫確認密碼；密碼保持原樣，不去除空白
    if (confirmPassword === "") {
      setError("請再次輸入密碼。");
      return;
    }

    // 兩個欄位都有填，再檢查是否一致
    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致。");
      return;
    }

    setSaving(true); // 開始送出，之後會用來停用表單

    try {
      const created = await createBuildingAdmin(selectedId, {
        name,
        email: trimmedEmail,
        phone,
        password, // 確認密碼不傳給後端
      });

      if (created === null) {
        setResult(null); // 登入失效時清除列表
        setPassword(""); // 清除頁面中的密碼
        setConfirmPassword("");
        router.replace("/login");
        return;
      }

      // 確認建立成功後，才清空表單
      setBuildingId("");
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setSuccess("管理員已建立並分配大樓。");
      setCreating(false);

      // 新管理員排在第一頁；從其他頁新增時，由 useEffect 載入第一頁
      if (page !== 1) {
        setLoading(true);
        setResult(null);
        setPage(1);
        return; // 仍會執行 finally，將 saving 恢復為 false
      }

      // 建立成功與刷新列表分開處理，避免誤報帳號建立失敗
      try {
        const latest = await getBuildingAdmins(1); // 已在第一頁時直接刷新列表

        if (latest === null) {
          setResult(null);
          router.replace("/login");
          return;
        }

        setResult(latest); // 顯示包含新管理員的第一頁列表
      } catch {
        setResult(null); // 不繼續顯示過期的列表
        setError(
          "管理員已建立，但列表更新失敗，請重新整理查看，勿重複建立。",
        );
      }
    } catch (err) {
      // 建立失敗時保留表單輸入，方便修正
      setError(
        err instanceof TypeError
          ? "無法連線，請確認網路後再試。"
          : err instanceof Error
            ? err.message
            : "建立管理員失敗，請稍後再試。",
      );
    } finally {
      setSaving(false); // 無論成功或失敗，都結束送出狀態
    }
  }

  function closeCreate() {
    if (busy) return;
    setCreating(false);
    setError("");
    setBuildingId("");
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
  }

  function closeAssignment() {
    if (busy) return;
    setAssignmentAdminId(null);
    setError("");
  }

  return (
    <main className="form-stack">
      <h1 className="sr-only">大樓管理員列表</h1>
      <div className="flex flex-wrap items-center gap-3">
        {result && <p>共 {result.total} 位大樓管理員</p>}
        <button
          type="button"
          className="button button-primary ml-auto"
          disabled={loading || busy || !result || buildings.length === 0}
          onClick={() => {
            setError("");
            setSuccess("");
            setCreating(true);
          }}
        >
          ＋ 建立大樓管理員
        </button>
      </div>

      {/* loading 為 true 時才顯示；role="status" 協助輔助工具讀出狀態 */}
      {loading && (
        <p className="mt-4" role="status">
          正在載入管理員列表…
        </p>
      )}

      {/* error 有內容時才顯示；role="alert" 提醒輔助工具這是錯誤訊息 */}
      {error && !creating && !assignmentAdmin && (
        <p className="mt-4 text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* 建立成功時，顯示成功訊息 */}
      {success && (
        <p className="mt-4 text-teal-700" role="status">
          {success}
        </p>
      )}

      {/* 已成功取得管理員列表，但沒有大樓可供分配時，提示先建立大樓 */}
      {!loading && result && !error && buildings.length === 0 && (
        <p className="mt-6">
          請先到
          <Link href="/buildings" className="text-teal-700 underline">
            大樓管理
          </Link>
          建立大樓，再建立管理員。
        </p>
      )}

      {/* 資料載入完成、管理員列表查詢成功且有可選大樓，才顯示表單 */}
      {creating && (
        <Modal title="建立大樓管理員" onClose={closeCreate}>
          <form onSubmit={handleSubmit} noValidate className="form-stack">
            {error && <p className="notice notice-error" role="alert">{error}</p>}

          {/* 送出期間停用整組欄位與按鈕，避免重複操作 */}
          <fieldset disabled={busy} className="form-grid">
            <div className="col-span-full">
              <label htmlFor="admin-building" className="block">
                分配大樓（必選）
              </label>
              <select
                id="admin-building"
                name="building_id"
                required
                value={buildingId}
                onChange={(event) => setBuildingId(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              >
                <option value="">請選擇大樓</option>

                {/* 顯示名稱與地址供辨識，實際選取值使用大樓 ID */}
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}｜{building.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin-name" className="block">
                姓名（必填，1～100 個字元）
              </label>
              <input
                id="admin-name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            <div>
              <label htmlFor="admin-phone" className="block">
                聯絡電話（必填，8～20 個字元）
              </label>
              <input
                id="admin-phone"
                name="phone"
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            <div className="col-span-full">
              <label htmlFor="admin-email" className="block">
                Email（必填，使用尚未註冊的地址）
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block">
                密碼（必填，8～128 個字元）
              </label>

              {/* password 隱藏輸入文字；new-password 提示瀏覽器這是新帳號密碼 */}
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            <div>
              <label htmlFor="admin-confirm-password" className="block">
                確認密碼（再次輸入相同密碼）
              </label>

              {/* 此欄位只供 handleSubmit 比對，不會傳給 API */}
              <input
                id="admin-confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            {/* 送出表單會執行剛才加入的 handleSubmit */}
            <div className="col-span-full flex flex-wrap justify-end gap-2">
              <button type="button" className="button" onClick={closeCreate}>取消</button>
              <button type="submit" className="button button-primary">
                {saving ? "建立中…" : "建立管理員"}
              </button>
            </div>
          </fieldset>
          </form>
        </Modal>
      )}

      {assignmentAdmin && (
        <Modal
          title={assignmentAdmin.building_id === null ? "分配大樓" : "調整分配"}
          onClose={closeAssignment}
        >
          <div className="form-stack">
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            {assignmentAdmin.building_id === null ? (
              <label>
                分配大樓給「{assignmentAdmin.name}」
                <select
                  value={assignmentSelections[assignmentAdmin.user_id] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAssignmentSelections((current) => ({ ...current, [assignmentAdmin.user_id]: value }));
                  }}
                  disabled={busy}
                >
                  <option value="">請選擇大樓</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}｜{building.address}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-2">
                <p>確定取消「{assignmentAdmin.name}」對「{assignmentAdmin.building_name ?? "此大樓"}」的管理分配嗎？</p>
                <p className="muted">取消後會立即失去該大樓的管理權，帳號與歷史紀錄仍會保留。</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="button" onClick={closeAssignment} disabled={busy}>
                取消
              </button>
              {assignmentAdmin.building_id === null ? (
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy || !assignmentSelections[assignmentAdmin.user_id]}
                  onClick={() => handleAssign(assignmentAdmin)}
                >
                  {busy ? "分配中…" : "分配大樓"}
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-danger"
                  disabled={busy}
                  onClick={() => handleUnassign(assignmentAdmin)}
                >
                  {busy ? "取消中…" : "確認取消分配"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 成功取得資料後，才顯示總數與列表 */}
      {result && (
        <div>

          {/* 這一頁沒有資料時顯示空資料提示，否則顯示名單 */}
          {result.items.length === 0 ? (
            <p className="mt-4">目前尚無大樓管理員。</p>
          ) : (
            <div className="manager-table-scroll">
              <table className="manager-parcel-table">
                <caption className="sr-only">大樓管理員列表</caption>
                <thead>
                  <tr>
                    <th scope="col">姓名</th>
                    <th scope="col">分配大樓</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((admin) => (
                    <tr key={admin.user_id}>
                      <td>{admin.name}</td>
                      <td>
                        {admin.building_id === null ? (
                          <span className="muted">尚未分配</span>
                        ) : (
                          <Link href={`/buildings/${admin.building_id}`} className="underline">
                            {admin.building_name}
                          </Link>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button whitespace-nowrap"
                          disabled={loading || busy || (admin.building_id === null && buildings.length === 0)}
                          onClick={() => {
                            setError("");
                            setSuccess("");
                            setAssignmentAdminId(admin.user_id);
                          }}
                        >
                          {admin.building_id === null ? "分配大樓" : "調整分配"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* 分頁按鈕不送出建立表單；載入期間舊名單與分頁列暫時隱藏 */}
          <nav aria-label="管理員列表分頁" className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => changePage(page - 1)}
              disabled={loading || busy || page <= 1}
              className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一頁
            </button>
            {/* 頁碼使用後端回傳值，對應目前顯示的名單 */}
            <p>第 {result.page} 頁／共 {totalPages} 頁</p>
            <button
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={loading || busy || page >= totalPages}
              className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一頁
            </button>
          </nav>
        </div>
      )}
    </main>
  );
}

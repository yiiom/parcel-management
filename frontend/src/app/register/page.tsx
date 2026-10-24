"use client"; // 這個頁面需要處理瀏覽器中的表單事件
import { useState, type FormEvent } from "react"; // 管理畫面狀態與表單事件型別
import { registerResident } from "@/api/auth"; // 匯入註冊 API 函式
import Link from "next/link";
import ResidentSteps from "@/components/ui/resident-steps";

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false); // 是否正在送出
  const [errorMessage, setErrorMessage] = useState(""); // 失敗提示
  const [successMessage, setSuccessMessage] = useState(""); // 成功提示

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // 阻止瀏覽器預設送出，避免重新載入頁面

    if (isSubmitting) return; // 送出中不重複處理

    const form = event.currentTarget; // 保存目前的表單
    const formData = new FormData(form); // 依 input 的 name 取得欄位內容

    setIsSubmitting(true); // 切換成送出中
    setErrorMessage(""); // 清除上次的錯誤
    setSuccessMessage(""); // 清除上次的成功提示

    try {
      const name = String(formData.get("name") ?? "").trim();
      const phone = String(formData.get("phone") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirm_password") ?? "");
      if (password !== confirmPassword) {
        throw new Error("兩次輸入的密碼不一致，請重新確認。");
      }
      if (Array.from(name).length < 1 || Array.from(name).length > 100) {
        throw new Error("姓名須為 1～100 個字元，不能只有空白。");
      }
      if (Array.from(phone).length < 8 || Array.from(phone).length > 20) {
        throw new Error("聯絡電話須為 8～20 個字元。");
      }
      if (Array.from(password).length < 8 || Array.from(password).length > 128) {
        throw new Error("密碼須為 8～128 個字元。");
      }
      await registerResident({
        name,
        email: String(formData.get("email") ?? "").trim(),
        phone,
        password, // 密碼保留原始空白
      });

      form.reset(); // 成功後清空欄位，包含密碼
      setSuccessMessage("註冊成功，請使用剛才的帳號密碼登入。");
    } catch (error) {
      // 網路連線失敗與後端拒絕註冊，分別顯示提示
      setErrorMessage(
        error instanceof TypeError
          ? "無法連線，請確認網路後再試。"
          : error instanceof Error
            ? error.message
            : "註冊失敗，請稍後再試。",
      );
    } finally {
      setIsSubmitting(false); // 無論成功或失敗，都解除送出中狀態
    }
  }
  // 四個輸入框共用的外觀樣式
  const inputClass = "mt-1 w-full rounded border px-3 py-2";

  return (
    <main className="mx-auto w-full max-w-md p-8 resident-onboarding">
      <ResidentSteps current={successMessage ? 2 : 1} />
      <h1 className="text-2xl font-bold">歡迎加入大樓包裹管理系統</h1>
      <p className="muted">先建立自己的住戶帳號，登入後再使用邀請碼加入戶別。</p>

      {successMessage ? <section className="form-stack onboarding-success">
        <h2>帳號已建立</h2>
        <p role="status">{successMessage}</p>
        <Link className="button button-primary" href="/login">下一步：前往登入</Link>
        <p className="muted">尚未加入任何戶別；登入後請準備管理員或入住代表提供的邀請碼。</p>
      </section> : <>

      {/* 表單送出時，執行 handleSubmit 呼叫後端 */}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {/* label 包住 input，讓欄位名稱與輸入框建立關聯 */}
        <label className="block">
          姓名
          <input
            className={inputClass}
            name="name"
            type="text"
            autoComplete="name"
            required
          />
        </label>

        <label className="block">
          Email
          <input
            className={inputClass}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={255}
            required
          />
        </label>

        <label className="block">
          聯絡電話
          <input
            className={inputClass}
            name="phone"
            type="tel"
            autoComplete="tel"
            required
          />
        </label>

        <label className="block">
          密碼（8～128 個字元）
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block">
          確認密碼
          <input className={inputClass} name="confirm_password" type="password" autoComplete="new-password" required />
        </label>

        {/* 有錯誤時顯示，並通知螢幕閱讀器 */}
        {errorMessage && (
          <p role="alert" className="text-red-600">
            {errorMessage}
          </p>
        )}

        {/* 註冊成功後顯示提示 */}
        {successMessage && (
          <p role="status" className="text-teal-700">
            {successMessage}
          </p>
        )}

        {/* 送出期間停用按鈕 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "註冊中…" : "建立住戶帳號"}
        </button>
      </form>
      <p className="mt-4"><Link href="/login" className="text-teal-700 underline">已有帳號？前往登入</Link></p>
      </>}
    </main>
  );
}

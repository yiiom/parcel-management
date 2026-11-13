import type { ReactNode } from "react";

// 手機外框：純 CSS 畫出，畫面內容由 children 提供。
// 只是示意用的裝飾，不放任何可互動內容，所以對輔助科技隱藏。
export default function PhoneFrame({
  size = "lg",
  children,
}: {
  size?: "lg" | "sm";
  children: ReactNode;
}) {
  return (
    <div className={`landing-phone landing-phone-${size}`} aria-hidden="true">
      <div className="landing-screen">
        <div className="landing-island" />
        <div className="landing-status">
          <span>9:41</span>
          <i />
        </div>
        {children}
        <div className="landing-home" />
      </div>
    </div>
  );
}

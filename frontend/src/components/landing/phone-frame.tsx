import type { ReactNode } from "react";

// 手機外框：純 CSS 畫出，畫面內容由 children 提供。
// 只是示意用的裝飾，不放任何可互動內容，所以對輔助科技隱藏。
// 大手機外面包一層「佔位框」：縮小時用 transform 縮放，佔位框負責保留縮小後的版面大小。
// 不用 CSS zoom：zoom 會讓手機瀏覽器誤判為窄欄位而放大裡面的字，把畫面撐破。
export default function PhoneFrame({
  size = "lg",
  children,
}: {
  size?: "lg" | "sm";
  children: ReactNode;
}) {
  const phone = (
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

  return size === "lg" ? <div className="landing-phone-slot">{phone}</div> : phone;
}

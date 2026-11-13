"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, icons } from "./icons";
import PhoneFrame from "./phone-frame";

// 四個功能：左邊白卡的文字，和手機裡四張畫面的順序要一致。
const features = [
  {
    id: "register",
    tag: "大樓管理員",
    title: "包裹登記",
    points: [
      "選擇住戶戶別，填寫收件人",
      "可補充物流公司、單號、存放位置與備註",
      "相同物流單號先提醒，避免重複登記",
      "登記後自動產生取件碼，登記錯誤也能更正",
    ],
  },
  {
    id: "pickup",
    tag: "住戶・大樓管理員",
    title: "取件碼與本人確認",
    points: [
      "住戶登入後查看自己這一戶的包裹與取件碼",
      "管理員核對取件碼，建立 10 分鐘的取件驗證",
      "交付包裹後，住戶以自己的帳號確認收到",
      "管理員不能代簽",
    ],
  },
  {
    id: "records",
    tag: "住戶・大樓管理員",
    title: "簽收紀錄",
    points: [
      "記錄簽收者、簽收時間與經手管理員",
      "可依日期篩選，快速找到某一次簽收",
      "紀錄不能修改或刪除",
      "日後改名，不影響當時的簽收姓名",
    ],
  },
  {
    id: "invite",
    tag: "大樓管理員・住戶",
    title: "戶別與邀請碼",
    points: [
      "管理員建立戶別與入住",
      "產生 4 位數邀請碼，24 小時內有效",
      "住戶註冊後輸入邀請碼，確認戶別即可加入",
      "同戶家人與室友共用包裹與簽收紀錄",
    ],
  },
];

export default function FeatureScroll() {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);

  // 算出這一段捲動區的位置：每個功能分到的捲動距離，扣掉最後一頁多停留的距離。
  const metrics = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;

    const rect = stage.getBoundingClientRect();
    const span = stage.offsetHeight - window.innerHeight;
    const holdVh =
      parseFloat(getComputedStyle(stage).getPropertyValue("--landing-hold")) || 0;
    const hold = (holdVh * window.innerHeight) / 100;

    return { top: rect.top, span, step: (span - hold) / features.length };
  }, []);

  // 頁面往下捲，依捲動進度決定目前是第幾個功能。
  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;
      const m = metrics();
      if (!m || m.span <= 0 || m.step <= 0) return;

      const scrolled = Math.min(Math.max(-m.top, 0), m.span);
      setActive(Math.min(features.length - 1, Math.floor(scrolled / m.step)));
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    // 視窗大小改變時，手機畫面直接回到目前這一張，不要慢慢滑。
    function onResize() {
      const track = trackRef.current;
      if (track) {
        track.style.scrollBehavior = "auto";
        track.scrollLeft = activeRef.current * track.clientWidth;
        track.style.scrollBehavior = "";
      }
      schedule();
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    schedule();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [metrics]);

  // 換頁時，手機裡的畫面橫向滑到對應的那一張。
  useEffect(() => {
    activeRef.current = active;
    const track = trackRef.current;
    if (track) track.scrollTo({ left: active * track.clientWidth });
  }, [active]);

  // 點圓點：捲到那個功能的捲動範圍中間。
  function jump(index: number) {
    const m = metrics();
    if (!m) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: window.scrollY + m.top + (index + 0.5) * m.step,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  return (
    <section className="landing-section" aria-labelledby="features-title">
      <div
        ref={stageRef}
        className="landing-stage"
        style={{ "--landing-n": features.length } as CSSProperties}
      >
        <div className="landing-pin">
          <h2 id="features-title">用一個系統，管好包裹的每一步</h2>

          <div className="landing-feat-grid">
            <div>
              <div className="landing-copy" aria-live="polite">
                {features.map((feature, index) => (
                  <article
                    key={feature.id}
                    className={`landing-panel${index === active ? " is-on" : ""}`}
                  >
                    <span className="landing-tag">{feature.tag}</span>
                    <h3>{feature.title}</h3>
                    <ul className="landing-points">
                      {feature.points.map((point) => (
                        <li key={point}>
                          <Icon>{icons.check}</Icon>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <div className="landing-dots" role="group" aria-label="切換功能">
                {features.map((feature, index) => (
                  <button
                    key={feature.id}
                    type="button"
                    className={`landing-dot${index === active ? " is-on" : ""}`}
                    aria-label={`第 ${index + 1} 個功能：${feature.title}`}
                    aria-current={index === active ? "true" : undefined}
                    onClick={() => jump(index)}
                  />
                ))}
                <span className="landing-dots-note">
                  示意畫面
                  <span className="landing-scroll-hint">・往下捲動看更多功能</span>
                </span>
              </div>
            </div>

            <PhoneFrame>
              <div ref={trackRef} className="landing-track">
                <div className="landing-slide">
                  <div className="landing-s-title">登記包裹</div>
                  <div className="landing-s-label">入住戶別</div>
                  <div className="landing-s-field">5F-3</div>
                  <div className="landing-s-label">收件人</div>
                  <div className="landing-s-field">王小明</div>
                  <div className="landing-s-label">物流公司</div>
                  <div className="landing-s-field">新竹物流</div>
                  <div className="landing-s-label">存放位置</div>
                  <div className="landing-s-field">櫃檯 A 櫃</div>
                  <div className="landing-s-btn">登記包裹</div>
                </div>

                <div className="landing-slide">
                  <div className="landing-s-title">取件碼</div>
                  <div className="landing-s-card landing-s-center landing-s-card-roomy">
                    <div className="landing-s-meta">你的取件碼</div>
                    <div className="landing-s-code">482917</div>
                    <div className="landing-s-split">
                      <div className="landing-s-meta landing-s-note">管理員已核對，請確認收到包裹</div>
                      <div className="landing-s-btn">確認收到</div>
                    </div>
                  </div>
                </div>

                <div className="landing-slide">
                  <div className="landing-s-title">簽收紀錄</div>
                  <div className="landing-s-rec landing-s-rec-head">
                    <span>簽收者</span>
                    <span>時間</span>
                  </div>
                  <div className="landing-s-rec">
                    <span>王小明</span>
                    <span>11/12 18:20</span>
                  </div>
                  <div className="landing-s-rec">
                    <span>林小華</span>
                    <span>11/12 09:05</span>
                  </div>
                  <div className="landing-s-rec">
                    <span>王小明</span>
                    <span>11/11 20:41</span>
                  </div>
                  <div className="landing-s-meta landing-s-note">經手管理員：陳管理員</div>
                </div>

                <div className="landing-slide">
                  <div className="landing-s-title">戶別邀請碼</div>
                  <div className="landing-s-card landing-s-center landing-s-card-roomy">
                    <div className="landing-s-meta">戶別邀請碼</div>
                    <div className="landing-s-code">0725</div>
                    <div className="landing-s-meta landing-s-note">有效至 11/14 14:30</div>
                    <div className="landing-s-gap">
                      <span className="landing-s-btn landing-s-btn-light">重新產生</span>
                      <span className="landing-s-btn landing-s-btn-light">停用</span>
                    </div>
                  </div>
                </div>
              </div>
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

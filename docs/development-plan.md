# 開發順序與驗收標準

### 2026-10-23 D-27 空白大樓刪除

- 使用者批准只有系統管理員可刪除沒有管理員分配、戶別及任何業務紀錄的大樓。已先同步 BR-03、D-27、確認清單、F-03、資料庫設計，再加入 `DELETE /api/buildings/{building_id}` 與詳情頁確認區。
- 後端沿用共用業務交易鎖，逐項檢查管理員分配、戶別與包裹直接關聯；其餘入住／邀請／簽收等紀錄受既有戶別及包裹外鍵鏈保護。外鍵禁止連帶刪除，衝突回傳 409；角色不符 403、未登入 401、不存在 404、成功 204。不新增 migration，不清除開發資料。
- 前端僅系統管理員顯示刪除區；列出大樓名稱與地址、不可復原提示，勾選後才能送出；送出期間停用修改與刪除，防止重複請求。成功返回列表；連線中斷不自動重送，要求重新查詢。
- 獨立 `parcel_management_test`：`acceptance_domain` 269 項通過，包含空白大樓刪除、帶 body 拒絕、管理員角色拒絕、有分配／有戶別拒絕、404 與全部 40 操作 HTTP 契約覆蓋；`acceptance_building_delete` 19 項通過，包含住戶拒絕、並行刪除只成功一次、分配與刪除競爭不會刪掉已分配大樓。
- 前端 TypeScript 與本次修改檔案 ESLint 通過；`artifacts/delete-building-ui.test.cjs` 模擬實際元件事件，角色隱藏、明確確認、防重複送出、成功導頁與拒絕提示通過。尚待使用者實際瀏覽器操作驗收，不提前標記功能整項或階段完成。
- Swagger 來源、JSON／YAML／HTML、後端契約與功能／階段對照同步：40 操作、30 路徑、43 schemas，階段 2／3 為 25／15。現行本機 `/openapi.json` 已包含新增 DELETE；下方 39 操作的舊驗收數字保留為歷史證據。

### 2026-10-23 前端換頁與帳號查詢改善

- 依使用者要求僅改善前端，不修改商業規則、API 或資料庫。共用版型不再依 pathname 重建；首次進入仍確認登入，後續換頁與視窗重新取得焦點時在背景更新帳號與大樓資訊，保留選單。
- 大樓管理、個人資料改用共用帳號資料，移除頁面初始載入的重複查詢；修改個人資料成功後重新同步共用帳號。登入頁、加入戶別回應遺失確認，以及搬離交易前後資格核對的查詢保留。
- 登入失效／停用清除內容並導向登入；查詢失敗清除舊內容並提供重試。身分、大樓分配或入住資格變更時重建內容區；忽略已離開路徑的舊回應。後端每次操作的權限驗證維持原樣。
- 驗證：TypeScript `--noEmit --incremental false`、三個修改檔案 ESLint 通過；`artifacts/account-navigation.test.cjs` 對實際共用版型執行 13 項模擬請求／Hook 回歸檢查通過，包含慢回應保留版型、背景刷新、範圍變更、401、過期回應及連線失敗。
- 尚待使用者於本機瀏覽器確認實際切頁體感；上述為靜態檢查與模擬回歸，不代表完整瀏覽器驗收，也未宣稱解決先前的 19 秒連線延遲。功能與階段完成狀態不變。

### 2026-10-12 本機後端入口修復

- 新增 `backend/app/main.py`，提供 FastAPI 啟動入口、既有 CORS 設定及 `/health` 資料庫連線檢查。
- 重啟本機 backend 容器；容器內匯入入口成功，健康檢查函式回傳 `status=ok`、`database=connected`。
- 實際請求 `http://127.0.0.1:8001/health` 成功。這是環境修復，未建表、未完成帳號或其他業務功能驗收，階段進度不變。

更新日期：2026-10-16。本文件人工維護，是開發進度的唯一紀錄入口；產生腳本不得覆蓋。

## 目前位置

- [x] 共用版型及三角色介面（含手機版、載入中、空資料、錯誤與無權限狀態）；保留 2A～2C 已完成功能，示範畫面不計業務功能完成。

### 2026-10-17 2B 前端 API 函式檢查

- 已檢查使用者在大樓列表頁匯入 `createBuilding`，並新增姓名、地址、電話、送出中及成功訊息 state；內容正確。此為表單準備，送出函式與表單尚未接上，不標示新增功能完成。

- 使用者續增 `createBuilding`：POST、Cookie、姓名地址去頭尾空白、選填電話空值轉 null、401 與一般錯誤處理已核對；TypeScript 與該檔 ESLint 再次通過。使用者截圖已確認列表空資料畫面；新增大樓表單及實際新增流程尚待完成。

- 使用者新增 `frontend/src/api/buildings.ts`：大樓及分頁型別、攜帶 Cookie 的 GET、401 回傳 null、其他錯誤提示已核對。
- 本機 TypeScript `tsc --noEmit --incremental false` 與該檔案 ESLint 檢查通過。
- 尚未由頁面呼叫，未視為列表功能或 AC-2B 完成。下一步由使用者建立大樓列表頁並驗證空資料狀態。

### 業務服務拆分（2026-10-16）

- 依使用者要求，將原本 1,026 行的 `backend/app/services/domain.py` 拆成大樓、管理員、戶別、入住、邀請、資格、包裹、簽收及異常服務；另抽出共用權限、驗碼限流、SQL 工具、時間／錯誤、服務集合與交易管理。原檔已移除，閱讀對照見 `backend/README.md`。
- 各功能透過 `ServiceContext` 共用同一連線、游標與重新確認的登入身分；維持原本資料庫鎖、提交／回滾，以及錯碼計數先保存的行為。路由改為呼叫對應服務；未修改 API、資料表或商業規則。
- 搬移的 57 個方法經 AST 比對，除跨服務呼叫位置外，方法內容保持一致；本機實際 OpenAPI 與拆分前完整比對一致。拆出的模組各為 22～196 行。
- 拆分前：業務 254 項、帳號 47 項、單元測試 11 項通過。拆分後：在獨立 `parcel_management_test` 依序重跑 `app.acceptance_domain` 254 項、`app.acceptance_2a` 47 項，全數通過，含跨表故障回滾與並行操作驗收。
- 單元測試新增 3 項，驗證跨服務共用交易與只提交一次、失敗回滾並釋放鎖、未取得鎖時不執行服務。Docker 執行 `python -m unittest discover -s tests -v` 共 14 項通過。
- 本次僅為後端結構整理；未重跑 DB 還原、重啟或正式映像建置，其證據仍為下方 2026-10-15 紀錄。前端／串接及功能整項完成狀態不變。

**後端目標最終核對（2026-10-15）：開發計畫內所有 DB／後端功能、對應測試與 review 修正已完成。最終證據為業務 254 項、帳號 47 項、單元測試 11 項，加上正式後端映像建置、DB 還原與重啟保存。逐項對照與修正見 [DB／後端 review 紀錄](backend-review.md)。下方補充審查段落保留過程；其中「尚待完成」已由本次最終核對取代。前端與功能整項仍待完成。**

### 後端與 DB 完整目標的補充審查（2026-10-15）

- 重新逐項核對後，2A～3D 業務驗收已有證據，但 AC-3E 的 DB 匯出還原、Docker 重啟保存仍缺實測證據；完整後端 review 與新手可讀性檢查尚在進行。因此尚不宣告使用者要求的「全部後端／DB、對應 test、review 修正」目標完成。
- 修正驗收啟動流程：子程序退出或健康檢查逾時立即停止，避免繼續發送業務請求。共用程式為 `backend/app/test_support.py`。
- 新增 `backend/tests/test_server_startup.py` 的 5 項測試，涵蓋正常啟動、連線失敗後重試、逾時、程序先退出及健康檢查期間退出。於 `backend` 執行 `python -m unittest discover -s tests -v`，5 項通過。
- 修正後在獨立 `parcel_management_test` 重跑 `app.acceptance_domain` 241 項與 `app.acceptance_2a` 47 項均通過。未修改前端或正式資料。
- 後續已補齊 DB 保存證據：`python -X utf8 backend/database_recovery.py --restart-mysql` 成功。使用 MySQL 8.4 的 mysqldump 匯出 `parcel_management_test` 全部結構與資料，還原至全新 `parcel_restore_test_c5faec78240d`，逐位元組比對一致；重啟本機 MySQL 後，來源與還原庫再次比對一致。未刪除容器、volume 或既有資料。
- 本機證據：`artifacts/database-recovery/parcel_restore_test_c5faec78240d/result.txt`，SQL 備份在同目錄且由 Git 忽略。還原庫保留供檢查；此工具不允許覆寫來源或開發庫。
- 新增備份工具 4 項安全測試，連同服務啟動 5 項，共 9 項單元測試通過。完整後端 review 與架構可讀性審查仍待完成；AC-3E 整項保留未勾選，因畫面整體驗收尚未完成。
- 可讀性 review 修正：將執行時解析契約、遞迴建立 Pydantic 型別的機制，替換為 `schemas/outputs.py` 中 24 個明確類別；路由直接引用類別，不再透過字串查找。保留既有欄位限制、UTC 處理與內部欄位排除。
- 新增 2 項回應測試，逐一比對 24 類別與共同契約，並驗證密碼雜湊不回傳、日期帶 UTC。Docker 執行 `python -m unittest discover -s tests -v` 共 11 項通過；重構後業務 241 項、帳號 47 項再次通過。
- 已整理業務服務、路由與模型格式，新增 `backend/README.md` 說明閱讀順序、交易例外、測試指令與修改 API 的同步方式。未增加框架或正式依賴；格式工具僅存忽略的 artifacts。

**第一階段與 2A 已完成。依 D-26，2B～2D、3A～3D 的 DB／後端已完成並通過驗收；下一步由使用者從 2B 開始前端。其餘功能整項、前端串接與 3E 整體驗收尚未完成。**

現有 39 個 API 均已實作，`/me` 已接上真實大樓分配與入住資格；10 張業務表與技術支援表已套用本機開發庫，既有帳號保留。前端仍只有原 2A；首頁依真實關聯顯示戶別／大樓的調整，也留給後續前端製作。

| 階段 | 內容 | 狀態 | 結束條件 |
|---|---|---|---|
| 1 | 商業邏輯、功能、開發及驗收文件 | 已完成 | 商業問題決議完成、文件對齊、使用者確認規則基線（D-17） |
| 2 | 基本功能的資料庫、後端、前端及串接 | DB／後端完成；2B～2D 前端待製作 | 從空白大樓完成管理建置與住戶加入 |
| 3 | 包裹、簽收、異常、搬離及整體測試 | 3A～3D DB／後端完成；前端／整體驗收待完成 | 三角色真實流程在本機 Docker 驗收通過 |

## 執行規則

- 三大階段依使用者決議固定；2A、3A 等是階段內步驟。
- D-26：剩餘功能先依 2B～2D、3A～3D 完成 DB／後端／API 測試，再由使用者製作前端。後端通過不等於功能整項完成；前端、串接及 3E 整體驗收分開追蹤。
- 畫面開發可暫用假資料；驗收必須使用實際 API 與資料庫。
- 第二階段建立基本功能需要的 7 張業務表；第三階段逐步加入包裹、驗證與簽收的 3 張表。必要技術支援表另記設計，不為維持表數犧牲正確性。
- 功能開始前處理相關 Q 與 T 項目；第一階段未通過不提前開發業務功能。
- 業務規則、資料庫、API、畫面與測試同步，規則不一致先問使用者。

## 第一階段文件驗收 AC-1

- [x] 建立商業邏輯、功能清單、開發驗收、待確認、決議、導覽與 AGENTS.md。
- [x] 同步姓名快照已確認決議，取代舊姓名顯示語意。
- [x] 對照39個API與三階段，產生腳本不再覆蓋人工進度。
- [x] Q-01～Q-10逐項確認，決議同步商業邏輯、功能、資料庫、API與驗收。
- [x] 技術事項安排處理時機；影響商業行為的選擇獲確認（D-17；T 清單分功能處理）。
- [x] 使用者確認本版規則及功能範圍，進入第二階段（D-17）。

已勾選項目代表文件工作完成，不代表業務功能完成或第二階段已開始。

## 第二階段基本功能

下列 AC 為功能整項驗收；DB／後端證據另列於本文件紀錄，前端未完成前不勾整項。

| 順序 | 功能 | 資料庫與後端 | 前端 | 驗收 |
|---|---|---|---|---|
| 2A | F-01、02 帳號與個人資料 | users、密碼、登入、權限及個人資料；依登入決議補技術支援 | 登入註冊、登出、個人資料、角色導覽 | AC-2A |
| 2B | F-03、04 大樓與管理員 | buildings、building_admins；建立、修改、查詢、分配取消 | 大樓管理、管理員建立及分配 | AC-2B |
| 2C | F-05 戶別與入住 | units、occupancies；戶號及有效入住唯一性 | 戶別表單、入住紀錄與建立 | AC-2C |
| 2D | F-06 邀請碼及加入 | unit_memberships、unit_invite_codes；驗證、加入、名單 | 產生停用碼、輸入確認加入、住戶名單 | AC-2D |

### AC-2A 帳號與權限

- [x] 註冊固定住戶；重複 Email、錯誤密碼、帳號停用均正確處理。
- [x] 只能修改自己的姓名電話，不能改角色或他人資料。
- [x] 未登入、登入到期、登出符合 Q-06，每次請求檢查帳號啟用。
- [x] 角色導向正確，無入住及無分配有提示，重新整理保持正確登入狀態。依 D-25，真實大樓分配及入住關聯查詢於 2B／2D 驗收。

### AC-2B 大樓與管理員

- [x] 系統管理員建立管理大樓；大樓管理員只能讀改自己大樓。2026-10-21 批次驗收：獨立測試庫後端 254 項及大樓／管理員追加 64 項通過；畫面新增、分頁、修改及欄位驗證通過；TypeScript、ESLint 通過；修正後瀏覽器重驗：列表載入／新增斷線均顯示中文，新增失敗保留輸入且按鈕恢復。
- [x] 同棟可多人，一人不可兩棟；未授權角色不能分配。2026-10-21 API 驗證通過；建立管理員畫面通過；管理員列表分頁已補，獨立測試庫瀏覽器驗收通過：45 位分成 20／20／5 筆、首尾按鈕邊界、往返切頁與輸入保留、載入時清除舊名單、第二頁新增後回第一頁並顯示 46 位、送出中停用分頁、切頁斷線中文提示及恢復後重新整理；TypeScript、ESLint 通過。本次保留測試分頁；恢復時瀏覽器控制曾逾時，重新連接後已確認列表與新資料正常。取消分配前端已串接，驗收細節見下項；既有管理員分配 API、選單、按鈕與事件已串接，TypeScript 與 ESLint 通過；瀏覽器驗證未選大樓提示、分配成功、其他卡片選項保留、總數 46 與頁碼不變，API 驗證同一登入立即取得新大樓權限且原大樓回 403；事件函式隔離測試的空選項、已有分配、斷線、登入失效、刷新失敗與成功六個分支均通過；2026-10-21 已以內建瀏覽器及獨立 3003／8003 測試代理補驗分配的三個錯誤分支：送出斷線顯示中文、保留選項並恢復按鈕；另一分頁登出後舊表單 POST 回 401，清除名單並返回登入；分配 POST 201 後列表 GET 模擬 503，保留成功訊息、清除名單並提示勿重複分配。恢復代理後重新載入確認 46 位及「保留分頁回歸管理員」已分配「批次驗收1021」，兩個測試分頁保留。
- [x] 取消分配立即失去原範圍權限，帳號與經手紀錄保留；既有帳號查找符合 Q-08。2026-10-21 API 取消／重新分配及現有登入權限更新通過；前端取消按鈕與事件已串接，TypeScript 與 ESLint 通過；獨立測試庫批次驗證成功取消後顯示尚未分配、隱藏取消按鈕、保留頁碼及 46 位總數，API 再查確認保存；原管理員同一登入存取原大樓回 403、帳號仍可讀取，管理員無取消權限；斷線顯示中文、原分配保留、按鈕恢復。已直接執行現有 handleUnassign 的隔離自動測試：confirm=false 不送 DELETE、不刷新、不變更狀態；DELETE 成功後刷新遭網路錯誤或 HTTP 503 時，保留成功訊息、清除舊列表、顯示中文提示並解除鎖定，均通過。瀏覽器確認視窗控制逾時，兩分支的真實瀏覽器驗證仍未完成；本次瀏覽器操作後測試帳號「保留分頁回歸管理員」已成為未分配；既有管理員分配 API、選單、按鈕與事件已串接，TypeScript 與 ESLint 通過；瀏覽器驗證未選大樓提示、分配成功、其他卡片選項保留、總數 46 與頁碼不變，API 驗證同一登入立即取得新大樓權限且原大樓回 403；事件函式隔離測試的空選項、已有分配、斷線、登入失效、刷新失敗與成功六個分支均通過；2026-10-21 已以內建瀏覽器及獨立 3003／8003 測試代理補驗分配的三個錯誤分支：送出斷線顯示中文、保留選項並恢復按鈕；另一分頁登出後舊表單 POST 回 401，清除名單並返回登入；分配 POST 201 後列表 GET 模擬 503，保留成功訊息、清除名單並提示勿重複分配。恢復代理後重新載入確認 46 位及「保留分頁回歸管理員」已分配「批次驗收1021」，兩個測試分頁保留，整項不勾選。測試分頁已標記保留。

### AC-2C 戶別與入住

- [x] 同棟相同戶號被阻擋，不同棟可重複，樓層戶號支援文字。
- [x] 同戶並行建立入住最多成功一次，目前及歷史可區分。
- [x] 更正戶別不改所屬大樓；其他棟管理員不能查看操作。

### AC-2D 邀請碼與加入

- [x] 原碼只顯示一次，後續不回傳原碼或雜湊；新碼使舊碼失效。
- [x] 無效、過期、停用、入住結束的碼不能加入，確認加入時重新檢查。
- [x] 同批次重試不重複，兩分頁加入不同戶最多成功一戶；同戶可加入多位成員。
- [x] 碼格式期限與重新加入符合 Q-04、09；住戶名單權限正確。

**階段 2 整體驗收：** 從初始化系統管理員出發，不依賴預建大樓與住戶，以畫面完成建立大樓、分配管理員、建立戶別入住、產生邀請碼及住戶加入。共用介面、錯誤提示及資料隔離隨功能驗收。

## 第三階段主要功能

| 順序 | 功能 | 資料庫與後端 | 前端 | 驗收 |
|---|---|---|---|---|
| 3A | F-07、08 包裹管理 | parcels、碼保存查找、登記更正列表詳情 | 表單、搜尋篩選、列表詳情 | AC-3A |
| 3B | F-09、10 取件簽收 | pickup_verifications、parcel_pickups；驗證取消確認交易、紀錄 | 顯示碼、櫃檯驗證、等待確認、簽收紀錄 | AC-3B |
| 3C | F-11 異常 | 異常與結果、取消驗證、恢復換碼 | 原因、恢復或退回、結果 | AC-3C |
| 3D | F-12、13 搬離更替 | 退出申請、個別取消、整戶結束跨表交易 | 申請名單、影響預覽及確認 | AC-3D |
| 3E | F-17 整體驗收 | API 契約、交易、備份還原及建置 | 手機桌面全流程與錯誤情境 | AC-3E |

### AC-3A 包裹管理

- [x] 管理員登記至有效入住，必填選填正確，重複登記符合 Q-01。
- [x] 住戶只看自己有效入住；同批次晚加入可看，新批次與搬離者不可看。
- [x] 搜尋、狀態、分頁及新到舊排序正確，不洩漏碼、密文或雜湊。
- [x] 更正只限允許狀態及同棟有效入住，已結束入住不能轉移；驗證互動於 3B 整合驗收。

### AC-3B 取件簽收

- [x] 錯碼、不符大樓、狀態或入住不能驗證；防猜符合 Q-05。
- [x] 驗證成功仍待領，同包裹只有一筆有效驗證，10 分鐘後不能確認。
- [x] 未驗證、已取消不能簽收；現場無法簽收符合 Q-03。
- [x] 同戶兩帳號並行確認最多成功一次；同簽收者有權限時重試得到原結果，失去資格者不能取得。
- [x] 簽收、包裹、驗證更新一起成功或失敗，驗證與簽收指向同包裹。
- [x] 完成後不能再取碼或取消；改名不影響簽收者與經手者歷史姓名。
- [x] 包裹更正、斷線恢復、其他管理員操作符合 BR 及 Q-07，不顯示過期成功畫面。

### AC-3C 異常處理

- [x] 原因必填，操作者時間由後端記錄，異常取消驗證且不能領取。
- [x] 再次異常清空前次處理結果，只保留最近一次；已簽收退回不能新增異常。
- [x] 恢復須填結果並換碼，已結束入住只能退回。

### AC-3D 搬離更替

- [x] 申請退出仍可操作；個別取消即失去權限，其他成員不變，舊邀請碼失效。
- [x] 重試撤銷不改時間、不停用後來的新碼。
- [x] 整戶結束前顯示未領包裹，多表更新一起成功或失敗。
- [x] 既有異常補充搬離原因；已簽收退回不變，舊包裹不能轉給新人或恢復領取。
- [x] 新入住看不到舊紀錄，撤銷資格與簽收並行不能繞過權限。

### AC-3E 本機整體驗收


## 功能進度追蹤

狀態：尚未開始／開發中／待驗收／已完成／受阻。只有相關 AC 通過並記錄證據才標已完成；佔位、文件與規格不算完成。共用能力隨階段開發。

| 功能 | 步驟 | 狀態 | 決議依據或現況 | 最後更新 |
|---|---|---|---|---|
| F-01 帳號 | 2A | 已完成 | Q-02、06；API 及三角色真實登入導覽通過，D-25 關聯查詢另留 2B／2D | 2026-10-15 |
| F-02 個人資料 | 2A | 已完成 | D-24：姓名 100／101、電話 8／20 邊界、本人更新、欄位白名單與前端串接通過 | 2026-10-15 |
| F-03 大樓 | 2B | 開發中 | DB／後端通過；前端／串接待完成 | 2026-10-15 |
| F-04 管理員 | 2B | 開發中 | Q-08；分配／取消與名單通過；前端／串接待完成 | 2026-10-15 |
| F-05 戶別入住 | 2C | 開發中 | DB／後端與並行唯一性通過；前端／串接待完成 | 2026-10-15 |
| F-06 邀請加入 | 2D | 開發中 | Q-04、09；碼與加入、防猜通過；前端／串接待完成 | 2026-10-15 |
| F-07 包裹登記更正 | 3A | 開發中 | Q-01、07；重複確認與更正交易通過；前端／串接待完成 | 2026-10-15 |
| F-08 包裹查詢 | 3A | 開發中 | DB／後端資料隔離與碼保護通過；前端／串接待完成 | 2026-10-15 |
| F-09 取件確認 | 3B | 開發中 | Q-03、05、07；並行與回滾通過；前端／串接待完成 | 2026-10-15 |
| F-10 簽收紀錄 | 3B | 開發中 | Q-10；姓名快照與資格隔離通過；前端／串接待完成 | 2026-10-15 |
| F-11 異常 | 3C | 開發中 | DB／後端恢復換碼、退回限制通過；前端／串接待完成 | 2026-10-15 |
| F-12 個別搬離 | 3D | 開發中 | Q-09；資格撤銷／重試／重新加入通過；前端／串接待完成 | 2026-10-15 |
| F-13 整戶更替 | 3D | 開發中 | DB／後端跨表回滾、舊資料隔離通過；前端／串接待完成 | 2026-10-15 |
| F-14 共用介面 | 2A～3E | 開發中 | 2A 表單、載入、錯誤、帳號導覽已實作；後續業務介面未開始 | 2026-10-15 |
| F-15 權限安全 | 2A～3E | 開發中 | 後端角色、大樓／入住隔離、碼保護與並行驗收通過；前端互動／整體驗收待完成 | 2026-10-15 |
| F-16 建表初始化 | 2A～3B | 開發中 | 001～013 已套用，重跑與初始化驗收通過；實際前端建置流程待驗收 | 2026-10-15 |
| F-17 測試交付 | 2A～3E | 開發中 | 業務 254 項、2A 回歸 47 項、單元 11 項通過；DB 還原／重啟、後端建置與 review 完成；3E 畫面待完成 | 2026-10-15 |

## 驗收紀錄格式

### 2026-10-15 D-26 DB／後端交付

- 範圍：2B～2D、3A～3D 的 DB／後端，前端未修改。新增 migrations 004～013、業務輸入／回應模型、34 個路由、業務交易服務、碼加密／防猜與獨立驗收程式；`/me` 改為真實查詢。
- `docker compose run --rm -T --no-deps -e DB_NAME=parcel_management_test backend python -m app.acceptance_domain`：241 項通過，39 個 operationId／路徑與契約一致，所有操作都有真實 HTTP 呼叫。
- 重點：兩棟隔離、同戶並行入住、並行加入兩戶、一次性顯示邀請碼、24 小時期限、碼耗盡保留舊碼、兩類碼各連錯 5 次暫停、重複包裹確認、修改取消驗證、姓名快照、同包裹僅一次簽收、同簽收者重試、取消資格／整戶結束與簽收並行。
- 真實 MySQL 交易注入中途失敗：簽收紀錄／包裹回滾；整戶搬離的入住、資格、邀請碼、驗證、包裹一起回滾。初版測試以 trigger 注入被 MySQL 權限拒絕，改為交易服務內注入例外；未調升資料庫權限。
- `acceptance_2a` 回歸 47 項通過。`compileall` 通過；Swagger 來源同步產生 39 操作、30 路徑、43 schemas 及後端回應契約。Docker 後端映像建置通過。
- 已對本機開發庫套用 004～013（新增表，不刪資料），重建後端容器。本機金鑰寫入未追蹤 `.env`，不輸出、不提交；測試大樓／住戶僅存獨立測試庫，首位開發用系統管理員由使用者輸入帳密初始化。
- 前端接續見 [串接交接](frontend-integration.md)。AC-2B～AC-3E 整項仍不勾選；正式部署、效能壓測與備份還原仍不算此次完成。

逐次追加日期、F 與 AC 編號、變更檔案或版本、執行命令或操作步驟、預期與實際結果、通過或失敗、未解問題。失敗不得勾選；修正後重驗受影響項目。

目前業務驗收證據見下方 2026-10-15 的 2A 紀錄；歷史紀錄保留當時狀態。

### 2026-10-15 2A 完成驗收（D-24、D-25）

- DB／後端：001～003 已套用；`docker compose exec -T -e DB_NAME=parcel_management_test backend python -m app.acceptance_2a` 在獨立 MySQL 測試庫通過 47 項。涵蓋住戶固定角色、重複 Email、錯誤密碼、停用帳號、姓名／電話與 Unicode 邊界、欄位白名單、本人修改、8 小時到期、登出憑證重播、裝置隔離、來源驗證、並行限流及初始化重跑。
- 曾發現並行限流的共享鎖升級死鎖，改用 upsert 取得一致寫入鎖後，10 個並行請求恰好放行 3 個；重驗通過。驗收程序另固定來源環境，避免繼承臨時容器連接埠導致 403，47 項再次全部通過。
- 前端：`eslint src`、`tsc --noEmit --incremental false` 與 `docker compose run --rm --no-deps frontend npm run build` 通過。正式建置包含登入、註冊、個人資料及角色首頁。
- 真實瀏覽器：使用獨立測試庫及臨時 3002／8002 服務，確認住戶、大樓管理員、系統管理員各自登入首頁；住戶尚未加入、管理員等待分配提示正確。住戶重新整理保留登入、修改個人資料後重新讀取仍保存、嘗試系統管理員路徑導回住戶首頁；登出返回登入頁。
- 既有使用者截圖補充：前端空白姓名、7 字電話被拒；登入失效顯示重新登入；連線失敗保留表單並可重試成功。原開發帳號已由使用者還原；本次新增測試資料留在獨立測試庫。
- 文件：同步 D-25、功能／資料庫／技術待辦／Docker 操作及 Swagger 來源；產出仍為 39 操作、30 路徑、43 schemas，引用檢查通過。2A 全部勾選；2B～2D、第三階段及後續資料範圍權限尚未完成。

### 2026-10-10 文件初建檢查（決議前歷史紀錄）

- 範圍：AC-1 的文件建立、已確認姓名規則、API 階段與功能對照。
- 執行 `python docs/swagger/build_spec.py`：38 個操作、29 個路徑、41 個 schema，引用檢查通過。
- 執行 `python docs/swagger/build_development_plan.py`：38 個操作無重複遺漏，階段 1／2／3 分別為 0／23／15。
- 檢查 12 份 Markdown 的本地連結，以及 F-01～F-17 進度對照：通過。
- 重新產生 API 對照前後比對本文件雜湊：相同，人工進度未被覆蓋。
- 姓名快照欄位與 API 描述一致；未執行建表、業務 API 或前端功能驗收。第一階段仍待 Q 決議及使用者確認。

## 決議補充驗收情境

- [ ] Q-01（BR-06、F-07、AC-3A）：同棟相同物流公司及單號先顯示既有紀錄，管理員確認後仍可新增；缺少物流公司或單號不比對。
- [x] Q-02（BR-02、F-01、F-02、AC-2A）：第一版維持註冊、登入、登出、修改姓名電話；修改密碼、忘記密碼及帳號啟停介面列後續。
- [ ] Q-03（BR-07、F-09、F-11、AC-3B）：仍由住戶本人確認，管理員不可代簽；未確認先留櫃檯，已交付未簽收先記錄異常並聯絡核對，恢復流程後本人確認，原有資格限制仍適用。
- [ ] Q-04（BR-05、F-06、AC-2D）：系統自動產生四位數字字串，保留開頭的0；全系統有效碼唯一，固定24小時到期，可提早停用或重發，新碼使舊碼失效。
- [ ] Q-05（BR-05、BR-07、F-06、F-09、AC-2D、AC-3B）：取件碼六位數字、同棟有效碼唯一；邀請碼與取件碼分別連錯5次，暫停該帳號對應驗證功能5分鐘，不影響其他功能。邀請碼驗證與確認加入共用失敗計數。
- [x] Q-06（BR-02、F-01、AC-2A）：登入成功起8小時到期，須重新登入；登出只影響目前裝置，後端使當次登入失效，其他裝置不受影響。
- [ ] Q-07（BR-06、F-07、F-09、AC-3A、AC-3B）：資料實際有變動就取消等待中的驗證，重新核對；只有更改入住歸屬時因本次更正換取件碼，其餘更正保留碼。異常恢復領取的換碼規則仍適用。
- [x] Q-08（BR-02、F-04、AC-2B）：系統管理員在管理員管理畫面選擇姓名及大樓，前端背景傳帳號ID；提供含已分配與未分配帳號的管理員列表，可調整大樓或取消分配，不要求手動輸入ID或Email查找。
- [ ] Q-09（BR-04、F-06、F-12、AC-2D）：已取消資格者取得新有效邀請碼，且無其他有效或等待退出資格時可重新加入；保留舊紀錄、建立新資格，不增加封鎖名單。
- [ ] Q-10（BR-07、F-10、AC-3B）：只有簽收者及經手管理員姓名保存簽收當時值；大樓名稱、樓層、戶號、收件人、物流公司及單號顯示目前關聯資料。

上述勾選是未來功能驗收，不因本次文件更新而勾選。

### 2026-10-10 決議同步檢查

- Q-01～Q-10均已確認，對應D-07～D-16；已同步商業、功能、資料庫、API與驗收文件。
- 重新執行兩支文件產生腳本：39個操作、30個路徑、43個schema，引用及功能階段覆蓋檢查通過；階段1／2／3為0／24／15。
- 檢查四位邀請碼、取消自訂期限輸入、管理員列表權限、重複新增確認欄位、限流回應及姓名快照語意：通過。
- 本地文件連結及10筆確認狀態檢查通過；重新產生前後的人工進度文件雜湊相同。
- 本次只更新文件與產生來源，未建表、未實作業務API或前端功能；業務驗收仍未執行。

### 2026-10-11 EC2 Demo 主機環境準備

- 使用者另建 parcel-management EC2 作為 Demo，並授權透過 SSH 完成環境安裝；本次為主機準備，不代表業務功能或網站部署完成。
- 主機：Ubuntu 24.04、t3.micro、20 GiB EBS；SSH 確認主機名稱為 ip-172-31-43-252。
- 從已設定的 Docker 官方 apt 來源執行 `sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`，退出碼 0。
- `sudo docker version`：Client／Server 均為 29.9.0；`docker compose version`：v5.6.0；`docker buildx version`：v0.38.0。
- `sudo docker run --rm hello-world`：成功下載並執行，輸出 Hello from Docker，退出碼 0；測試容器執行後自動移除。
- `systemctl is-active docker` 為 active；`systemctl is-enabled docker` 為 enabled。
- `swapon --show` 確認 /swapfile 為 5G；`findmnt --fstab --types swap` 確認永久設定為 `/swapfile none swap sw`。使用者已於本次安裝前重開機並確認 Swap 自動啟用。
- `df -h /`：根目錄約 19G、已用 8.0G、可用 11G。Docker 操作目前使用 sudo。
- 本次未上傳應用程式、未建立業務資料庫或公開網站；第二、三階段功能驗收狀態不變。SSH 私鑰僅用於驗證連線，未複製至專案或遠端主機。

### 2026-10-11 CI/CD 文件

- 依使用者要求新增 `docs/cicd-deployment.md`，並加入文件導覽。
- 規劃 GitHub Actions 建置、ECR 映像、私有 S3 部署包與 OIDC／SSM 部署至既有 Demo EC2；不要求將 SSH 私鑰存入 GitHub。
- 記錄根目錄尚未納入 Git、frontend 現有 master 分支及無 remote、現有 Dockerfile／Compose 為開發設定等啟用前條件。
- 文件包含 IAM 權限範圍、Variables／Secrets 邊界、workflow 範本、主機部署入口契約、資料庫遷移限制、版本回復及驗收清單。
- 文件檢查：Markdown 程式碼區塊與本地連結通過；使用 Python PyYAML 解析 workflow 範本成功，確認包含 ci／deploy 工作。這是語法及結構檢查，不代表 GitHub Actions 或 AWS 權限已驗收。
- 本次僅交付文件；未建立 AWS 資源、workflow 實體檔或部署腳本，未修改 EC2，未執行遠端自動部署。CI/CD 仍待實作及端到端驗收，業務功能完成狀態不變。

### 2026-10-11 實作 CI/CD 與 EC2 部署測試

- 使用者明確更正為直接撰寫 CI/CD 程式，依 D-18 實作。前一節「僅交付文件」為歷史狀態，本次已新增實體程式。
- 新增 `.github/workflows/deploy.yml`、`aws-identity.yml`、前後端 `Dockerfile.prod`、`deploy/compose.prod.yaml`、Nginx、部署入口、發版工具、AWS CloudFormation 及一次性 provision 腳本。
- 前端啟用 standalone，依套件內 Next.js 文件先 typegen 再 TypeScript 檢查；保留既有開發 Dockerfile 與 Compose。
- Docker 正式映像建置成功；前端 lint、型別及 next build 通過，後端 compileall 與 app import 通過。
- `python -m unittest discover -s deploy/tests -v`：3 項測試通過，涵蓋部署包往返、版本不符、非法映像設定、路徑穿越及連結拒絕。
- actionlint：兩份 workflow 通過；ShellCheck：7 支 shell 腳本通過；cfn-lint：AWS 範本通過。GitHub action 使用 git ls-remote 查證過的固定 commit SHA。
- 以 Git Bash 執行 `deploy/ci-smoke.sh`，前端、後端、MySQL、Nginx 全部 healthy，首頁與資料庫 health 檢查通過。測試容器已停止移除，測試用獨立 volume 保留，不操作本機開發資料。
- EC2 已安裝 `/usr/local/sbin/parcel-deploy` 與 AWS CLI 2.35.21；建立 root 專用 600 權限環境檔，使用兩組隨機資料庫密碼，未輸出或上傳秘密。
- 實際載入本機建置映像，使用本次部署腳本在 EC2 啟動四個服務；公開首頁 `http://18.183.250.218/` 回傳 200，`/health` 回傳 status=ok、database=connected。
- EC2 同版本重跑成功；故意設定無效 Nginx 指令，部署以非零碼失敗並成功回復上一版。current 保留成功版本，MySQL volume 建立時間不變，health 再次通過。
- 遠端驗證版本使用 40 個 1 作為測試 revision，因根目錄尚未納管 Git，這不是 Git commit。正式 workflow 使用實際 GITHUB_SHA 和 ECR digest。
- 尚未取得 GitHub repository 與 AWS 管理存取；EC2 原先沒有 IAM profile。尚未建立雲端 ECR／S3／OIDC 角色，未從 GitHub 執行 push → AWS → EC2 端到端驗收，不能標示自動部署已啟用。
- 目前公開的是專案骨架與環境檢查，不代表業務功能完成；未執行業務建表 migration，未新增商業功能。HTTPS／網域及帳號安全流程仍待後續，現有頁面不可當成已完成的包裹系統。


### 2026-10-11 依現有專案精簡 CI/CD

- 依使用者最新要求與 D-19，移除 demo Environment、demo 部署群組、額外 AWS 設定檢查、AWS 身分 workflow，以及 ECR／S3／OIDC／SSM 相關程式。前一節為變更前歷史證據。
- workflow 改為 CI 建置並測試 → 保存映像 → SSH 傳送至 ubuntu@18.183.250.218 → 載入映像及 Compose 部署；保留專案名稱 concurrency 避免同時部署。
- 唯一部署 Secret 為 EC2_SSH_KEY；主機公鑰沿用本機已成功連線的 known_hosts，要求嚴格驗證。主機網址欄位改為 APP_BASE_URL，預設使用目前 EC2 IP。
- actionlint、5 支腳本的 ShellCheck／bash -n、3 項部署包測試通過。
- 使用已有正式映像實際測試新 SSH 傳輸及 install-release.sh：兩份 checksum 通過、docker load 成功、四個服務 healthy、部署退出碼 0；公開 /health 回傳 status=ok、database=connected。
- 遠端測試 revision 仍是 40 個 1 的人工版本；GitHub runner 的 SSH 網路來源、Repository secret 與根目錄 Git 納管尚未完成，未標記 GitHub push 自動部署已驗收。業務功能完成狀態不變。

### 2026-10-11 CI/CD 改用 GHCR、前後端分開與自動清理

- 依使用者說明的流程與 D-20 改版。前一節的「保存映像 → SSH 傳送 → 載入映像」為變更前歷史做法。
- workflow 加入路徑篩選；以 frontend、backend 目錄的 Git tree SHA 作為映像標籤，GHCR 已有相同標籤即跳過建置。串接檢查通過後才 push，部署使用 digest。移除映像 artifact 的上傳與下載。
- `ssh-deploy.sh` 不再傳送映像檔，改傳 digest 並以標準輸入傳遞短效 token；`install-release.sh` 以暫存 DOCKER_CONFIG 登入 GHCR，結束時連同上傳目錄移除；`release.sh` 只 pull 前後端映像、加上 `--remove-orphans`，成功後清理 current、previous 以外的前後端映像與版本目錄，不處理 volume。
- `python -m unittest discover -s deploy/tests -v`：4 項通過，新增「倉庫映像必須以 digest 指定」案例。
- 5 支腳本 `bash -n` 通過；以本機既有的 koalaman/shellcheck 與 rhysd/actionlint 映像檢查，ShellCheck 與 actionlint 均無訊息、退出碼 0。
- 以 Git Bash 執行 `bash deploy/ci-smoke.sh <40 個 2> parcel-frontend:<40 個 1> parcel-backend:<40 個 1>`：四個服務 healthy，首頁與 `/health` 通過，退出碼 0，測試容器已移除。使用本機既有映像，本次未重新建置前後端映像（Dockerfile 與原始碼未變更）。新增一個獨立測試 volume `parcel-ci-222…_mysql_data`，依規則未刪除。
- 在無網路的隔離容器以替身 docker 指令演練 `cleanup`：只刪除 current／previous 未使用的前後端映像與版本目錄；current 未指向本次版本時不刪除任何項目；Docker 拒絕刪除使用中映像時繼續執行；無法辨識保留映像時略過映像刪除。
- 同樣方式演練 `install-release.sh` → `release.sh`：連續三次部署後只留最近兩個版本目錄；第四次故意失敗時回復上一版、退出碼 1；缺少登入資訊時退出碼 2。五種情況下上傳目錄與登入暫存目錄均已移除，測試 token 未寫入任何檔案。
- 根目錄 Git 關聯：使用者建立 https://github.com/yiiom/parcel-management.git 後，`git ls-remote` 確認遠端為空；執行 `git init -b main` 與 `git remote add origin`，`git remote -v` 顯示 fetch／push 均為該網址。`git check-ignore` 確認 `.env`、`artifacts`、`frontend/node_modules`、`frontend/.next` 均被忽略。
- 依 D-21 處理 T-08：`frontend/.git` 複製至 `artifacts/frontend-git-backup.git`，`git fsck --full` 無錯誤、`diff -r` 與來源相同、可讀出原本唯一一筆提交 684f620，之後移除 `frontend/.git`。`git add -A` 共 86 個檔案（frontend 32、backend 19、docs 18、deploy 10 及根目錄設定）；檢查檔名與內容，無 `.env`、私鑰、node_modules、artifacts，本機 `.env` 的密碼值未出現在任何待提交檔案。
- 完整專案的首次推送被 GitHub 拒絕：本機儲存的憑證沒有 `workflow` 權限，無法建立 `.github/workflows/deploy.yml`；遠端維持為空。該筆本機提交未推送，已重做。
- 使用者改為要求先只推送文件、排除程式碼。提交範圍：`docs/`（含產生 API 文件的來源腳本）、根目錄 `README.md`、`AGENTS.md`、`.gitignore`、`.gitattributes`。`frontend/`、`backend/`、`deploy/`、`.github/`、`compose.yaml`、`.env.example` 保留在本機，未納入提交，檔案未刪除。
- 因此 GitHub 上目前沒有 workflow，CI/CD 尚未觸發，也未建立任何 GHCR 映像。文件中指向程式檔案的連結在程式碼推送前無法於 GitHub 開啟。推送程式碼前仍須先以具備 `workflow` 權限的憑證重新登入。
- 文件提交 26592f3 推送成功，`git ls-remote` 確認遠端 main 指向該提交。
- 使用者重新登入後要求推送程式碼：第二筆提交納入 `frontend/`、`backend/`、`deploy/`、`.github/workflows/deploy.yml`、`compose.yaml`、`.env.example`。此推送會首次觸發 workflow；執行結果另行記錄，未取得結果前不視為 CI/CD 已驗收。
- 程式碼提交 1ec381d 推送成功並觸發 workflow 第一次執行（run 38078469002）。隨後使用者更正為先不要包含任何程式碼、只放文件。處理方式：新增一筆提交，將 `frontend/`、`backend/`、`deploy/`、`.github/`、`compose.yaml`、`.env.example` 共 64 個檔案自版本管理移除，本機檔案保留。未改寫歷史，因此 1ec381d 仍留在 GitHub 的提交紀錄中，可從歷史看到程式碼；是否改寫歷史待使用者決定。
- 該次 workflow 執行並未因此停止。以 GitHub 公開 API 查得 run 38078469002 的結果：`ci` job 成功，包含部署工具驗證、登入 GHCR、判斷變更、前後端建置（兩者皆判定為有變更）、串接檢查、推送映像並記錄 digest；`deploy` job 在「部署至 EC2 並驗證」步驟失敗，符合預期，因為 `EC2_SSH_KEY` 未設定且安全群組未開放 runner。這是 CI 階段第一次在 GitHub 實際通過；部署階段仍未驗收，「未變更即跳過建置」的路徑也尚未實際執行過。
- 該次執行已將 `parcel-frontend`、`parcel-backend` 映像推送至 GHCR，映像內含建置後的程式；是否刪除由使用者決定。
- 移除程式碼的提交 e59479b 推送成功，未觸發新的 workflow 執行（總執行次數維持 1），後續推送不會再觸發。憑證管理員存有兩個 GitHub 帳號導致推送時要求選擇，已將 origin 網址指定為 `yiiom` 帳號。
- 使用者自行刪除了本機的 `backend/app/main.py`，未還原；該檔內容仍存在於提交 1ec381d。
- 以上為替身演練，不是真實 Docker 或 GHCR 的結果。

### 2026-10-11 EC2 固定 IP

- 依 D-22。使用者於應用程式內建瀏覽器自行登入 AWS Console，由代理操作；本機沒有 AWS CLI 或憑證。
- 變更前查看：東京區域有兩台機器，parcel-management（執行中，18.183.250.218，無 Elastic IP）與另一台已停止的機器（已綁定既有 Elastic IP）。後者未做任何變更。
- 配置新 Elastic IP：54.199.27.86（eipalloc-02335f586d19bec8d），使用 Amazon IPv4 集區、網路邊界群組 ap-northeast-1。
- 綁定至 i-0ca2ca24f4a29468d，Console 顯示「已成功建立關聯」，私有 IP 172.31.43.252，未勾選允許重新建立關聯。
- 驗證：`http://54.199.27.86/` 回傳 200，`/health` 回傳 status=ok、database=connected；`http://18.183.250.218/` 已無法連線。`ssh-keyscan 54.199.27.86` 取得的 ed25519 主機金鑰與 `deploy/ec2_known_hosts` 原記錄相同，確認為同一台主機。
- 同步更新舊 IP：`.github/workflows/deploy.yml` 的 EC2_HOST、`deploy/bootstrap.sh`、`deploy/compose.prod.yaml` 的預設值、`deploy/ec2_known_hosts` 及 `docs/cicd-deployment.md`。本文件較早段落中的 18.183.250.218 為歷史紀錄，未修改。更新後部署工具測試 4 項通過、`bash -n` 與 actionlint 通過、檔案維持 LF。
- 使用者提供 SSH 金鑰位置後，以唯讀指令查看主機（未顯示密碼值）：四個容器皆 healthy；current 為 `releases/111…/20261011-1`；只有 80 埠對外；磁碟可用 7.7G。環境檔的設定名稱為 MYSQL_PASSWORD、MYSQL_ROOT_PASSWORD、DEMO_BASE_URL、HTTP_PORT，**沒有 APP_BASE_URL**；DEMO_BASE_URL 是舊名稱，目前的 Compose 不讀取。後端實際的 `CORS_ORIGINS=http://18.183.250.218` 來自主機上該版 `compose.prod.yaml` 的預設值。
- 首次嘗試修正時，遠端寫入指令被權限設定擋下，未對主機做任何變更。使用者同意後，於 `.claude/settings.local.json` 加入只針對此金鑰與主機的 ssh 允許規則。
- 主機修正：環境檔備份為 `.env.bak-20261011-fixed-ip`（權限 600），加入 `APP_BASE_URL=http://54.199.27.86` 後重新套用目前版本。Compose 輸出顯示只有 backend 被 Recreate，nginx、mysql、frontend 為 Running 未重建；四個容器 healthy，後端 `CORS_ORIGINS=http://54.199.27.86`。這是「未變更的容器不會重啟」在 EC2 上的實測結果。

### 2026-10-11 EC2 HTTPS（已啟用；真實續期待觀察）

- 依 D-23。查證 Let's Encrypt 與 EFF 官方說明：IP 憑證於 2026-01-15 正式開放，僅能使用 shortlived 設定檔與 HTTP 或 TLS-ALPN 驗證；Certbot 5.4 起 webroot 支援 `--ip-address`。主機 `docker pull certbot/certbot:latest` 取得 5.8.0，`--help all` 確認具備 `--ip-address`、`--required-profile`、`--cert-name`、`--deploy-hook`；主機 Nginx 為 1.28.3，具 SSL 與 HTTP/2 模組。
- 新增 `deploy/nginx-https.conf`、`nginx-locations.conf`、`tls-issue.sh`、`tls-renew.sh`；`nginx.conf` 加入憑證驗證路徑與容器內檢查埠 8081；`compose.prod.yaml` 加入 443 埠、憑證與驗證目錄掛載、以 NGINX_CONF 選擇模式；`release.sh` 與健康檢查改用 8081；`release_tools.py` 的部署包檔案清單同步增加；`ssh-deploy.sh` 的公開檢查改讀 APP_BASE_URL。
- 部署工具測試 4 項通過；7 支腳本 `bash -n` 與 ShellCheck 通過。
- `bash deploy/ci-smoke.sh <40 個 3> …`：HTTP 模式首頁、`/health`、憑證驗證路徑通過；以自簽憑證切到 HTTPS 模式時只有 nginx 被 Recreate，HTTPS 首頁與 `/health` 通過、HTTP 回傳 301、驗證路徑仍可讀取；退出碼 0。過程中發現腳本內嵌 Python 以系統預設編碼讀取 Compose 檔，在繁體中文 Windows 會失敗，已改為明確指定 UTF-8。新增獨立測試 volume `parcel-ci-333…_mysql_data`，未刪除。
- 以 40 個 1 為 revision、沿用主機既有映像打包部署包（9 個檔案，逐位元組確認皆為 LF），上傳至主機 `/home/ubuntu/parcel-https-upload`，主機端 sha256 與本機一致。
- **部署尚未執行**：上傳後 SSH 連線逾時。於 AWS Console 以唯讀方式查看安全群組：443 與 80 已對所有來源開放，22 只允許 1.165.96.9/32；執行當下本機對外 IP 為 125.230.12.229，判斷為網路業者更換 IP。安全群組未做任何修改，待使用者更新 SSH 規則。主機仍為原版本與 HTTP 模式，網站正常。
- 使用者修改 SSH 規則：第一次存成 `0.0.0.0/32`（不符合任何來源，SSH 仍無法連線），第二次改為 `125.230.12.229/32` 後連線成功；於 Console 唯讀確認 22 埠未對所有來源開放。規則由使用者本人修改，代理未變更安全群組。
- 部署新版本（HTTP 模式）：主機端校驗部署包 sha256 後解開至 `releases/111…/20261011-https1`，以 local 模式執行 `release.sh`。Compose 輸出只有 nginx 被 Recreate，其餘三個容器 Running；`deployments.log` 記錄 started 與 success。部署後 current 指向新版本、previous 為 `20261011-1`，版本目錄只剩這兩個（原有的 `manual-test-final` 已由清理流程移除），前後端映像保留。Nginx 掛載確認為新版 `nginx.conf`、`nginx-locations.conf`、`shared/letsencrypt`、`shared/acme`，容器對外為 80 與 443，`nginx -t` 通過。
- 公開驗證：`http://54.199.27.86/` 200、`/health` 回傳 status=ok、database=connected、`/.well-known/acme-challenge/probe` 回傳寫入的測試內容。443 尚無服務（HTTP 模式），符合預期。
- 以空白暫存設定目錄執行不連網的 `certbot certificates`，確認 5.8.0 接受 `--register-unsafely-without-email`、`--agree-tos`、`--non-interactive`、`--required-profile shortlived`、`--cert-name`、`--ip-address`；前者未列於 `--help all` 但仍可用。未向任何 ACME 伺服器註冊。
- 執行備註：以 `bash -s` 經標準輸入傳入遠端腳本時，`release.sh` 內的 `docker compose exec` 會讀走後續輸入，導致腳本後半段未執行；部署本身不受影響，後續檢查已另行補跑。正式流程的 `install-release.sh` 在呼叫前已先讀完標準輸入，不受此影響。
- 憑證申請：由使用者本人執行 `tls-issue.sh 54.199.27.86`（主機 sudo 紀錄有 1 次呼叫）。主機檢查結果：`live/parcel` 下四個檔案齊全；憑證 SAN 為 IP Address:54.199.27.86，簽發者 Let's Encrypt YE1，效期 2026-10-10 19:01:58 至 2026-10-17 11:01:57 GMT；續期設定為 webroot、required_profile=shortlived、正式環境伺服器；`parcel-tls-renew.timer` 為 enabled、active。
- 切換 HTTPS：環境檔備份為 `.env.bak-20261011-before-https`，設定 `NGINX_CONF=nginx-https.conf` 與 `APP_BASE_URL=https://54.199.27.86` 後重新套用目前版本，腳本內含失敗即還原的處理（本次未觸發）。Compose 輸出為 backend 與 nginx 被 Recreate，frontend、mysql 為 Running；容器內 `nginx -t`、8081 首頁與 `/health` 檢查通過；`deployments.log` 記錄 https-enabled。Nginx 掛載的設定為 `nginx-https.conf`，後端 `CORS_ORIGINS=https://54.199.27.86`。
- 主機端以一般憑證驗證連線：`https://54.199.27.86/` 200 且 ssl_verify_result=0，`/health` 回傳 status=ok、database=connected，`http://54.199.27.86/` 301 轉至 https；`openssl s_client` 的 Verify return code 為 0。
- 本機（外部）以未加 `-k` 的 curl 驗證：HTTPS 首頁 200 且憑證驗證通過，`/health` 正常，`http://` 的首頁與 `/health` 皆 301，跟隨轉址後為 200；帶 `Origin: https://54.199.27.86` 時回應的 access-control-allow-origin 相符。
- 續期排程：手動執行 `systemctl start parcel-tls-renew.service`，Result=success、退出碼 0，紀錄為「Certificate not yet due for renewal」「No renewals were attempted」，未留下重新載入標記。這只驗證排程與腳本可執行；**真實的重新簽發與 Nginx 重新載入尚未發生**，預計 2026-10-13 前後首次發生，須屆時查看紀錄確認。
- workflow 的 deploy job 加入 `APP_BASE_URL: https://54.199.27.86`。驗證用的探測檔已自主機移除。
- 主機上留有兩份環境檔備份（`.env.bak-20261011-fixed-ip`、`.env.bak-20261011-before-https`，權限 600、含資料庫密碼），未刪除。未連線 EC2、未變更主機。GitHub push → GHCR → EC2 端到端仍未執行；根目錄 Git 納管、`EC2_SSH_KEY` 與安全群組 SSH 來源等前置條件不變，不能標示自動部署已啟用。業務功能完成狀態不變。
### 2026-10-14 住戶註冊前後端串接測試

- 證據：使用者本機操作與截圖。
- 從註冊頁成功建立帳號，顯示成功提示、清空欄位並恢復按鈕。
- 重複 Email 顯示「此 Email 已註冊。」，保留輸入並恢復按鈕。
- MySQL 查詢確認 frontend-test@example.com 只有一筆，角色為 resident。
- TypeScript 與註冊相關檔案的 ESLint 檢查通過。
- 以上為註冊基礎串接證據；2A 尚未完成，不勾選整行。

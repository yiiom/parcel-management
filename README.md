# 大樓包裹管理系統

前端使用 TypeScript、React、Next.js；後端預計使用 FastAPI、MySQL。
目前已建立專案結構、基本頁面與 Docker 開發設定。後端只有資料庫連線健康檢查，尚未實作登入與業務 API。

開發前先閱讀 [文件導覽](docs/README.md) 與 [專案開發規則](AGENTS.md)。目前為第一階段：文件已建立，Q-01～Q-10決議已同步，待技術準備；功能完成狀態統一記錄於 [開發順序與驗收](docs/development-plan.md)。

Docker 啟動方式請參閱 [Docker 開發環境](docs/docker-development.md)。

## 專案結構

```text
parcel-management/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # 共用根版型（原有）
│   │   │   ├── page.tsx            # 首頁（原有）
│   │   │   ├── login/page.tsx      # 登入基本頁面
│   │   │   ├── register/page.tsx   # 註冊基本頁面
│   │   │   ├── join/page.tsx       # 加入戶別基本頁面
│   │   │   ├── admin/             # 系統管理員頁面
│   │   │   ├── manager/           # 大樓管理員頁面
│   │   │   └── resident/          # 住戶頁面
│   │   ├── components/
│   │   │   ├── layout/            # 側欄、導覽列
│   │   │   ├── ui/                # 按鈕、視窗、狀態標籤
│   │   │   └── parcels/           # 包裹表單、列表、取件碼
│   │   ├── api/                   # 呼叫 FastAPI 的前端函式，不是後端路由
│   │   ├── hooks/                 # 資料載入與更新
│   │   └── types/                 # TypeScript 資料型別
│   ├── public/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # 預留 API 入口
│   │   ├── database.py            # 預留 MySQL 連線
│   │   ├── routers/               # API 路由
│   │   ├── services/              # 功能規則與流程
│   │   ├── repositories/         # SQL 查詢、更新
│   │   ├── schemas/              # 輸入與回傳格式
│   │   └── core/                 # 設定、登入與權限
│   └── requirements.txt
├── .gitignore
└── README.md
```

空資料夾中的 `.gitkeep` 用來讓 Git 保留資料夾，不包含程式功能。
既有的 Next.js 設定、樣式、圖示等檔案維持原樣，以上僅列主要結構。
三個角色資料夾目前沒有頁面，也尚未加入權限檢查。

## 啟動前端

在專案根目錄開啟終端機：

```powershell
cd frontend
npm run dev
```

開啟終端機顯示的網址，通常為 http://localhost:3000。
可查看 `/login`、`/register`、`/join` 三個基本頁面，尚無表單功能。
後端可透過 Docker 啟動，提供 `/health` 資料庫連線檢查與 `/docs`；業務功能仍待開發。

## Git 現況

專案統一由根目錄 Git 管理（分支 main），遠端為 https://github.com/yiiom/parcel-management.git。
目前 GitHub 上只有文件；前端、後端與部署程式保留在本機，尚未推送。
Next.js 建立工具原本在 `frontend` 內初始化的獨立 Git 已依 D-21 備份後移除。

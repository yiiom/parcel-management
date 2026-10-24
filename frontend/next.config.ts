import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// 僅本機 Compose 啟用：沿用同一個 Tailwind loader，讓 Webpack 輪詢更新時保留樣式。
// 正式建置未設定此環境變數，仍使用上方原有的 Turbopack 設定。
if (process.env.LOCAL_DEV_WEBPACK === "1") {
  nextConfig.webpack = (config, { dev }) => {
    if (dev) {
      config.module.rules.push({
        // 巢狀前置處理保留 Next.js 內建的 CSS 載入與熱更新流程。
        rules: [
          {
            test: /\.css$/i,
            enforce: "pre",
            use: ["@tailwindcss/turbopack"],
          },
        ],
      });
    }
    return config;
  };
}

export default nextConfig;

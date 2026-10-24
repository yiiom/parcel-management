import ParcelWorkspace from "@/components/parcels/workspace";

// 預設顯示異常包裹；保留既有查詢及詳情功能。
export default function ExceptionsPage() {
  return <ParcelWorkspace exceptionMode />;
}

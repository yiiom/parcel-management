import { getParcels, type ParcelFilters } from "@/api/parcels";

// 只合併呈現分類；兩種狀態仍由既有 API 分別查詢及檢查權限。
export async function getResidentExceptions(filters: ParcelFilters, page: number) {
  const groups = await Promise.all((["exception", "returned"] as const).map(async (status) => {
    const first = await getParcels({ ...filters, status }, 1);
    const items = [...first.items];
    // 各來源只需前 page 頁，即足以決定合併後第 page 頁的位置。
    const last = Math.min(page, Math.ceil(first.total / first.page_size));
    for (let current = 2; current <= last; current += 1) {
      items.push(...(await getParcels({ ...filters, status }, current)).items);
    }
    return { ...first, items };
  }));
  const pageSize = groups[0].page_size;
  const items = groups.flatMap((group) => group.items).sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id,
  );
  return {
    page,
    page_size: pageSize,
    total: groups.reduce((total, group) => total + group.total, 0),
    items: items.slice((page - 1) * pageSize, page * pageSize),
  };
}

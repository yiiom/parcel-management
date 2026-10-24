import { notFound } from "next/navigation";
import EndOccupancyWorkspace from "@/components/move-outs/end";

function positiveId(value: string | string[] | undefined) {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]*$/.test(value)
  ) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export default async function EndOccupancyPage({
  searchParams,
}: {
  searchParams: Promise<{
    unit?: string | string[];
    occupancy?: string | string[];
  }>;
}) {
  const query = await searchParams;

  if (query.unit === undefined && query.occupancy === undefined) {
    return <EndOccupancyWorkspace />;
  }

  const unitId = positiveId(query.unit);
  const occupancyId = positiveId(query.occupancy);

  if (unitId === null || occupancyId === null) notFound();

  // URL 只決定查詢目標，實際所屬關係及權限仍重新查詢。
  return (
    <EndOccupancyWorkspace
      key={`${unitId}:${occupancyId}`}
      initialTarget={{ unitId, occupancyId }}
    />
  );
}

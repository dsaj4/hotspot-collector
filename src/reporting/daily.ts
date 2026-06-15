import { writeReportPlaceholder } from "../core/storage.js";

export async function generateDailyReport(): Promise<{ status: "not implemented"; reportRef: string }> {
  const reportRef = await writeReportPlaceholder();
  return { status: "not implemented", reportRef };
}

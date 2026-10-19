import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/reports/csv";
import { fetchReport, parseReportParams } from "@/lib/reports/fetch";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const url = new URL(request.url);
  const params = parseReportParams(kind, url.searchParams.get("from"), url.searchParams.get("to"));
  if (!params) return NextResponse.json({ code: "INVALID_REPORT" }, { status: 400 });

  const { user, profile } = await getSession();
  if (!user || !profile || profile.role !== "admin" || profile.status !== "active") {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const rows = await fetchReport(params.kind, params.from, params.to);
    const range = [params.from ?? "start", params.to ?? "today"].join("_to_");
    const filename = `palm-bite-${params.kind}-${range}.csv`;
    const body = rows.length ? toCsv(rows) : "no_records\r\n";
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ code: "TEMPORARY_ERROR" }, { status: 503 });
  }
}

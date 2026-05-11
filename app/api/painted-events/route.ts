import { NextResponse } from "next/server";
import {
  fetchCurrentBasepaintDay,
  fetchPaintedEventsForDay,
  parsePaintDay,
} from "@/lib/basepaintEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayParam = searchParams.get("day");

  let day: bigint;
  try {
    day = dayParam ? parsePaintDay(dayParam) : await fetchCurrentBasepaintDay();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to resolve BasePaint day",
      },
      { status: dayParam ? 400 : 500 },
    );
  }

  try {
    const events = await fetchPaintedEventsForDay(day);

    return NextResponse.json({
      day: day.toString(),
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Failed to fetch Painted events:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch Painted events",
      },
      { status: 500 },
    );
  }
}

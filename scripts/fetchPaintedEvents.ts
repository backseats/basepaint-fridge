import { writeFileSync } from "fs";
import { join } from "path";
import {
  fetchPaintedEventsForDay,
  parsePaintDay,
} from "../lib/basepaintEvents";

const day = parsePaintDay(process.argv[2] ?? "886");
const outputPath = join(process.cwd(), `painted-events-day-${day}.json`);

async function main() {
  console.log(`Fetching Painted events for day ${day}...`);

  const events = await fetchPaintedEventsForDay(day);

  writeFileSync(outputPath, JSON.stringify(events, null, 2));

  console.log(`Saved ${events.length} events to ${outputPath}`);
  if (events[0]) {
    console.log("\nSample event:");
    console.log(JSON.stringify(events[0], null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

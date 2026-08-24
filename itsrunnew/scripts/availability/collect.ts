import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { collectAvailability } from './collectors';

function tokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const dateIndex = process.argv.indexOf('--date');
const date = dateIndex >= 0 ? process.argv[dateIndex + 1] : tokyoDateKey();
if (!date) throw new Error('--date requires YYYY-MM-DD');

const now = new Date();
const facilities = await collectAvailability(date, { now });
const dataset = { schemaVersion: 1, date, timezone: 'Asia/Tokyo', generatedAt: now.toISOString(), facilities };
const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(scriptDirectory, '../../src/data/availability.json');
await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

const counts = facilities.reduce<Record<string, number>>((result, item) => {
  result[item.status] = (result[item.status] ?? 0) + 1;
  return result;
}, {});
console.log(`Availability generated for ${date}: ${facilities.length} facilities -> ${output}`);
for (const status of ['available', 'partially_available', 'unknown', 'unavailable']) console.log(`${status}: ${counts[status] ?? 0}`);

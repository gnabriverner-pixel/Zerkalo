// Read-only report: anonymous path counters per day. Usage: tsx scripts/path_counters_report.ts [--file path] [--include-test] [--json]
import { PATH_EVENTS, dailyCounts, pathCountersFile, readPathCounters } from '../server/pathCounters';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const fileIdx = args.indexOf('--file');
const file = fileIdx >= 0 ? args[fileIdx + 1] : pathCountersFile();
const rows = readPathCounters(file);
const days = dailyCounts(rows, flag('--include-test'));

if (flag('--json')) {
  console.log(JSON.stringify(Object.fromEntries(days), null, 2));
} else if (!days.length) {
  console.log('Нет событий' + (flag('--include-test') ? '' : ' (тестовые не учитываются; --include-test)'));
} else {
  console.log(['день', ...PATH_EVENTS].join('\t'));
  for (const [day, counts] of days) console.log([day, ...PATH_EVENTS.map(n => counts[n])].join('\t'));
}

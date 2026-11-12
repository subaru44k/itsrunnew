import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceHash, type CourseConfig } from './collector';
import { refreshCourseAvailability } from './refresh';
const argument = (name:string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name)+1] : undefined;
const config:CourseConfig = JSON.parse(await readFile(new URL('./sources.json',import.meta.url),'utf8'));
const output = resolve(argument('--output') ?? 'src/data/availability/running-courses.json');
const captureDirectory = argument('--capture');
if (captureDirectory) await mkdir(captureDirectory,{recursive:true});
const captures:{url:string;file:string}[]=[];
// CI checkouts contain an old snapshot. Reuse the published, validated snapshot
// until its weekly check is due; an unavailable publication triggers collection.
let previous:unknown;
try {
  const response=await fetch('https://itsrun.info/availability/running-courses.json',{signal:AbortSignal.timeout(10000),cache:'no-cache'});
  if (response.ok) previous=await response.json();
} catch { /* Collect fresh sources below. */ }
const {document:result,reused}=await refreshCourseAvailability(config,{previous,force:process.argv.includes('--force'),capture:async (url,body)=>{
  if (captureDirectory) { const file=sourceHash(url).slice(0,16)+'.txt';await writeFile(resolve(captureDirectory,file),body);captures.push({url,file}); }
}});
await mkdir(resolve(output,'..'),{recursive:true});
await writeFile(output+'.tmp',JSON.stringify(result,null,2)+'\n');
await rename(output+'.tmp',output);
if (captureDirectory) await writeFile(resolve(captureDirectory,'index.json'),JSON.stringify(captures,null,2)+'\n');
for (const course of result.courses) console.log(`${course.courseId}: ${course.unknownReason ?? 'checked'}; ${course.pending.length} notices need review`);
console.log(`Course status ${reused?'reused':'collected'}; next check ${result.nextCheckAt}`);

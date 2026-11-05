import { appendFileSync, existsSync, readFileSync } from 'node:fs';
const state = existsSync('.cache/publication-state.json') ? JSON.parse(readFileSync('.cache/publication-state.json', 'utf8')) : { status: 'not_started' };
const verified = process.env.PUBLISH_RESULT === 'success' && process.env.VERIFY_RESULT === 'success';
const outcome = verified ? 'Published and verified' : state.status === 'published' ? 'Published; public verification did not succeed' : state.status === 'started' ? 'Publication failed; partial writes may exist' : 'Not published';
const text = `## ${process.env.ITSRUN_DEPLOY_SCOPE} publication\n\n${outcome}\n\nSource: \`${process.env.ITSRUN_SOURCE_SHA}\`\n\nValidation run: ${process.env.VALIDATION_RUN_ID ?? 'collector revision validated before collection'}\n\nPublish: ${process.env.PUBLISH_RESULT ?? 'not started'}; verify: ${process.env.VERIFY_RESULT ?? 'not started'}\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
console.log(text);

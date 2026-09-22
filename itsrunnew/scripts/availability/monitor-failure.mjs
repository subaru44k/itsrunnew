import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const directory = process.argv[2];
if (!directory) throw new Error('Monitoring output directory is required');
await mkdir(directory, { recursive: true });
const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
await writeFile(join(directory, 'events.json'), JSON.stringify([{ kind: 'opened', trackId: '_monitor', name: 'Availability監視ジョブ', finding: { causes: ['monitor_job_failed'] } }]));
await writeFile(join(directory, 'notification.txt'), `Availability監視ジョブが失敗しました。施設の収集状態を確認できていません。\n実行ログ: ${runUrl}\n\n履歴の取得・公式資料の収集・設定を確認してください。次回の比較基準は更新しません。\n監視ジョブ自体の障害は、失敗した実行ごとに通知します。\n`);

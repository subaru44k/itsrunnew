# ItsRun

ItsRun の静的Webサイトです。Vue 3、TypeScript、Vite、Pinia、Vuetify 3で構成し、Firebaseやその他のバックエンドには接続しません。競技場スケジュールは日付をブラウザ内で生成し、各時間帯を「情報なし」として表示します。

## ローカル実行

```sh
npm install
npm run dev
```

品質確認:

```sh
npm test
npm run build
```

## AWSプレビュー環境

AWS CDKが、公開アクセスを遮断したS3バケットとOrigin Access Control付きCloudFront Distributionを作成します。独自ドメインやRoute 53は構成しません。

```sh
npm run infra:synth
npm run infra:deploy
```

デプロイ後のURLは `cdk-outputs.json` の `VerificationUrl` で確認できます。プレビュー環境を削除する場合は `npm run infra:destroy` を実行します。

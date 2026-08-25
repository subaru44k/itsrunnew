# GA4 product analytics

ItsRunはGA4 property `G-YNLS7KQXYW`へ、同意済みの正式domain利用者についてだけpage viewと製品操作eventを送ります。Preview、ローカル環境、同意前・拒否後は送信しません。緯度・経度、住所、住所検索文字列など、利用者の正確な場所を表す値は送信しません。

## Event contract

| Event | Trigger | Main parameters |
|---|---|---|
| `date_select` | 日付shortcut/native input | `selected_date`, `source`, `locale` |
| `facility_select` | 地図・一覧・近隣施設から施設を選択 | `track_id`, `source`, `selected_date`, `availability_status`, `locale` |
| `facility_detail_view` | 独立した施設詳細を表示 | `track_id`, `selected_date`, `availability_status`, `locale` |
| `view_on_map_click` | 施設詳細から地図へ戻る | `track_id`, `selected_date`, `locale` |
| `use_location` | 現在地取得を要求 | `action`, `selected_date`, `locale` |
| `use_location_result` | 現在地取得の結果 | `result`, `selected_date`, `locale` |
| `search_origin_select` | 現在地または地図上の地点を距離基準にする | `origin_type`, `selected_date`, `locale` |
| `search_origin_clear` | 距離基準を解除 | `origin_type`, `selected_date`, `locale` |
| `show_unavailable_change` | 利用不可表示switchを変更 | `enabled`, `selected_date`, `locale` |
| `prefecture_toggle` | 都道府県groupを開閉 | `prefecture`, `expanded`, `selected_date`, `locale` |
| `no_results` | 選択条件の候補が0件 | `include_unavailable`, `selected_date`, `locale` |
| `availability_source_click` | 公式予定を開く | `track_id`, `selected_date`, `availability_status`, `locale` |
| `official_site_click` | 施設公式サイトを開く | `track_id`, `selected_date`, `availability_status`, `locale` |
| `directions_click` | Google Maps経路を開く | `track_id`, `selected_date`, `availability_status`, `locale` |

event名とparameter名はsnake_caseで固定し、意味を変える場合は既存名を流用せず、この表・実装・testを同時に更新します。`services/analytics.ts`はlocation/search由来のprivate parameter名を送信直前にも除外します。

## GA4 administration

コード配備後、GA4の「管理 > データの表示 > カスタム定義」で次のevent-scoped custom dimensionsを登録します。

- `track_id`
- `selected_date`
- `source`
- `availability_status`
- `locale`
- `origin_type`
- `result`
- `prefecture`

boolean値や件数は必要になった時点で追加し、未使用dimensionを先回りして増やしません。`official_site_click`、`availability_source_click`、`directions_click`は利用判断につながる主要actionなので、実データがRealtime/DebugViewで確認できた後にkey event候補とします。単なる`facility_select`や`date_select`は探索操作であり、当初はkey eventにしません。

## Verification

1. Productionでアクセス解析へ同意する。
2. GA4 RealtimeまたはDebugViewで操作eventとparameterを確認する。
3. 拒否時、Preview、localhostではGA script/eventが送られないことをsmokeで維持する。
4. GA4の通常report反映には時間差があるため、配備直後はRealtimeを使用する。

GA4 UI上のcustom definition/key event登録はrepositoryから自動変更しません。権限を持つ人が上記を一度登録します。

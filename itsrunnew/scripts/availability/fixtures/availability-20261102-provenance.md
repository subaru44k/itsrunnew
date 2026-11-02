# 2026-11-02 availability official-source review

Initial independent monitor: https://github.com/subaru44k/itsrunnew/actions/runs/41373083752 (cd0e9d7).
Previous scheduled monitor: https://github.com/subaru44k/itsrunnew/actions/runs/41281679512. Its new Hakata/Chita incidents occurred after the previous automation finished; they were not discarded as old notifications.

## Chita

Fetched and read the complete current https://www.chita-sports.com/info/105/ HTML. The expired November 1 dedicated-use line and October PDF link were removed. The explicit renovation remains **Reiwa 8 November 3 (Tuesday) through Reiwa 9 March 31**, and identifies Chita sports park athletics stadium. The initial article date 2024-04-23 is not the renovation year. Normalized visible body hash is `40d8627554afaff8de9d7919f280b763c978518719b97f5f4b476a4267da3e1b`. Adopt only this exact body in addition to the previously reviewed body; do not apply the deleted November 1 claim to it. November 2 and dates after March remain unknown. All 149 renovation dates, no opening inference, removed day, boundaries and changed-content rejection tested. No AI fallback.

## Hakata no Mori auxiliary track

Homepage now links https://www.midorimachi.jp/higashihirao/images/park/261101151155895.pdf, one A3 page dated 2026-11-01, titled Reiwa 8 November. Rendered at 1800px and visually reviewed the complete page, all 30 auxiliary-track cells, weekday/year agreement, 9–17 opening header and event-end opening footnote; main stadium, tennis, archery and parking columns are separate and not used as auxiliary restrictions. The November auxiliary schedule is semantically unchanged from the prior reviewed two-page October/November file. Four no-opening dates: 1,13,21,29. Event-end openings: 3=13,6=15,8=15,14=14,15=15,28=14; all end17. Other dates9–17. Actual end-of-event caveat retained, no December or October extrapolation.

Re-fetched and read https://www.midorimachi.jp/higashihirao/guides/ general opening section (paid, same-day reception, no advance reservation, no natural-turf field access) and rendered/reviewed both complete pages of its linked https://www.midorimachi.jp/higashihirao/images/parknews/260512133125820.pdf. These guide/rule hashes are unchanged. Exact ordered URL/page-hash aggregate excluding homepage news: `8ad5e2c49c323f49e69d057d498b0b65891beb55d06d321ecc4958fa57737a93`. Fixture test re-renders original PDFs with the actual sourceInputs path and checks every image hash; additional collector integration rejects changed documents without AI.

## Ishin auxiliary track

New official notice https://www.ishin100.com/main/info_mirasta_kojin_20261102/ links November and December images (both dated November 1), replacing the October5 notice. Retrieved and visually read all 61 rows of both full-size original images, identifying auxiliary track and confirming weekdays against 2026. New November bookings (5/7/18/21/28 etc.) do not establish whole-day closure and remain unknown. November explicit open2,6,12,16,19,24,26,30 at08:30–17; cleaning closure9. December explicit open3,7,10,17,21,24,28 at08:30–17; cleaning closure14. Blank/event-only days remain unknown, including December29–31 whose gray fill has no explicit closure text. Do not infer open slots outside a listed event.

Also re-fetched the repair notice https://www.ishin100.com/main/info_hojyo_track_syuzzen_kouji_20261019/ and visually reread its unchanged original condition image/map: November26–28 straight practice reverse direction, lanes5–8 only; 200/400/middle/long-distance usual practice. Notice normalized hash changed solely with neighboring article navigation; both condition images unchanged. Exact new packet and original HTML/images retained. Separate finite source set prevents mixing old/new month images or unreviewed documents. Missing documents, all61 statuses/periods, Nov26 partial status and no AI fallback tested. This restores reviewed extraction, **not the historical coverage_drop**: no unsupported unknown is promoted for a recovery badge.

## Kohnodai

https://www.city.ichikawa.lg.jp/page/4185.html (updated2026-10-30) now includes https://www.city.ichikawa.lg.jp/uploaded/attachment/60729.pdf for December and still explicitly opens times outside scheduled usage. Rendered and visually reviewed the complete original page, all31 rows and weekdays matching December2026. Ordinary hours9–21, early closing7/14 at17, closure21 and28–31. Bookings5=9–12+12–17;6=9–17;12=9–13+14–17 (13–14 explicitly free);13=9–17;19=9–12+12–17;20=9–17;26=9–17;27=9–13+13–17. All other dates fully open9–21. Original exact bytes only; other months/years/changed bytes or missing general-opening policy rejected. Test all31 dates, times, scope, eligibility and source provenance through actual discovery/collection.

## Continuing external information gap

Nissan https://www.nissan-stadium.jp/track/index.php fetched again, exact raw SHA256 `225478a5a00d22f2aeba985add74d59d0adc556d3363c5c757d8cde8213e66f4`, unchanged since previous review. Month table lacks year-bearing entry/date anchors; no inferred opening or closure. Kozukue coverage incident stays open until proper dated evidence returns. An affected date becoming past is not recovery.

## Raw original SHA-256

- `chita-20261102.html.gz`: `222cf4cfa423594e1691515d17bcedf9d10157b2fd68bfcabbb749452689a01b`
- `hakata-20261102.html.gz`: `ae7b3c465f7a40341e096a2d276674db564049850085d75bea36f400cd1c110c`
- `hakata-guide-20261102.html.gz`: `7c92fd1076d586086df35881886d0b8f6c38f8367341c0a0fc91f47962f56de7`
- `hakata-20261101.pdf`: `35d2abdfe503c9046a70572746144877acc092e834cb634b8f4c589f19494391`
- `hakata-rules-20261102.pdf`: `d378a27f5c0e3a3f5a37a43a54ed632519edee78cedf0dffd577bbb3978f9f44`
- `ishin-0-20261102.html.gz`: `325248f2ec2048c246e452a22e623913079b7685f2efe5792a856091e34747cd`
- `ishin-3-20261102.html.gz`: `c28719f88484787623619ead27070c15c2e516369d99a51800c89c517076ecd1`
- `ishin-nov-20261102.png`: `4ed87a8b277994c2522980a8cbd60ed5b53c13108cbca79ea7d8b0c648a4de48`
- `ishin-dec-20261102.png`: `8c27eb69fb616ad355f0809b9c65447463421edbee02ffbffc1ad265b6ce7486`
- `kohnodai-20261102.html.gz`: `6cbc7f2a90057bcdf4fcbb1a1f1e0483b28a6ecd35a29b1ab53822442ac8689e`
- `kohnodai-202612.pdf`: `6a7af2fc563f276a9c285276861e660ffefb9f696f09b6c7bc803b28d1930065`

HTML originals are gzip containers; the hash above is for the committed compressed file. Normalized text/image hashes used by runtime are in the reviewed packets. No runtime API or key is needed for these four corrections.

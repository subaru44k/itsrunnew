<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <v-card class="mt-3 mb-3 p-3">
          <p class="display-1">田中希実アンテナ</p>
          <p class="title">豊田自動織機TC所属の陸上競技選手、田中希実選手の試合の記録を追いかけるページ</p>
          <p class="body-2">第一線で活躍する陸上選手としては非常に珍しい頻度で大会に参加するので、いつどの大会に出てどんな結果だったか簡単にまとめました。2020年のホクレンディスタンスくらいからのパフォーマンスが凄まじいので、それくらいまでは記載したいと思います。</p>
          <Adsense v-if="rendered" style="display:block" data-ad-client="ca-pub-7941378059940304" data-ad-slot="6879016191" data-ad-format="auto" data-full-width-responsive="true">
          </Adsense>
          <p class="headline">各年度へのリンク</p>
          <div><a href="#2021">2021年</a></div>
          <div><a href="#2020">2020年</a></div>
          <v-layout>
            <v-flex hidden-sm-and-up>
            </v-flex>
            <v-flex hidden-xs-only>
            </v-flex>
          </v-layout>
          <p class="headline mt-4"><a name="2021">2021</a></p>
          <div class="table-responsive">
            <table class="table table-bordered table-striped">
              <thead>
                <tr>
                  <th scope="col">日付</th>
                  <th scope="col">大会名</th>
                  <th scope="col">種目</th>
                  <th scope="col">タイム</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>10/17(日)</td>
                  <td>北九州カーニバル</td>
                  <td>800m</td>
                  <td>2'06"78</td>
                </tr>
                <tr>
                  <td rowspan="3">10/9(土)</td>
                  <td rowspan="3">ナイタートライアルin屋島</td>
                  <td>1500m</td>
                  <td>4'08"81</td>
                </tr>
                <tr>
                  <td>3000m</td>
                  <td>8'50"47</td>
                </tr>
                <tr>
                  <td>5000m</td>
                  <td>15'55"99</td>
                </tr>
                <tr>
                  <td>10/2(土)</td>
                  <td>日体大長距離記録会</td>
                  <td>5000m</td>
                  <td>15'00"90</td>
                </tr>
                <tr>
                  <td>9/23(木)</td>
                  <td>TWOLAPS MIDDLE DISTANCE CIRCUIT</td>
                  <td>800m</td>
                  <td>2'06"76</td>
                </tr>
                <tr>
                  <td>9/20(月)</td>
                  <td>日体大長距離記録会</td>
                  <td>800m</td>
                  <td>2'02"36</td>
                </tr>
                <tr>
                  <td>8/20(金)</td>
                  <td>TWOLAPS MIDDLE DISTANCE CIRCUIT</td>
                  <td>1000m</td>
                  <td>2'37"72</td>
                </tr>
                <tr>
                  <td>8/6(金)</td>
                  <td rowspan="4">東京オリンピック</td>
                  <td>1500m</td>
                  <td>3'59"95</td>
                </tr>
                <tr>
                  <td>8/4(水)</td>
                  <td>1500m</td>
                  <td>3'59"19</td>
                </tr>
                <tr>
                  <td>8/2(月)</td>
                  <td>1500m</td>
                  <td>4'02"33</td>
                </tr>
                <tr>
                  <td>7/30(金)</td>
                  <td>5000m</td>
                  <td>14'59"93</td>
                </tr>
                <tr>
                  <td>7/17(土)</td>
                  <td>ホクレンディスタンスチャレンジ 千歳大会</td>
                  <td>1500m</td>
                  <td>4'04"08</td>
                </tr>
                <tr>
                  <td>7/14(水)</td>
                  <td>ホクレンディスタンスチャレンジ 北見大会</td>
                  <td>5000m</td>
                  <td>15'17"93</td>
                </tr>
                <tr>
                  <td>7/10(土)</td>
                  <td>ホクレンディスタンスチャレンジ 網走大会</td>
                  <td>3000m</td>
                  <td>8'40"84</td>
                </tr>
                <tr>
                  <td rowspan="2">6/27(日)</td>
                  <td rowspan="4">日本陸上競技選手権大会</td>
                  <td>800m</td>
                  <td>2'04"47</td>
                </tr>
                <tr>
                  <td>5000m</td>
                  <td>15'18"25</td>
                </tr>
                <tr>
                  <td>6/26(土)</td>
                  <td>800m</td>
                  <td>2'07"23</td>
                </tr>
                <tr>
                  <td>6/25(金)</td>
                  <td>1500m</td>
                  <td>4'08"39</td>
                </tr>
                <tr>
                  <td>6/6(日)</td>
                  <td>Denka Athletics Challenge Cup 2021</td>
                  <td>1500m</td>
                  <td>4'09"06</td>
                </tr>
                <tr>
                  <td>6/1(火)</td>
                  <td>木南道孝記念陸上競技大会</td>
                  <td>1500m</td>
                  <td>4'10"06</td>
                </tr>
                <tr>
                  <td>5/15(土)</td>
                  <td>中部実業団対抗陸上競技大会</td>
                  <td>3000m</td>
                  <td>8'58"54</td>
                </tr>
                <tr>
                  <td>5/9(日)</td>
                  <td>READY STEADY TOKYO</td>
                  <td>1500m</td>
                  <td>4'09"10</td>
                </tr>
                <tr>
                  <td>5/3(月)</td>
                  <td>静岡国際陸上競技大会</td>
                  <td>800m</td>
                  <td>2'03"19</td>
                </tr>
                <tr>
                  <td>4/29(木)</td>
                  <td>織田幹雄記念国際陸上競技大会</td>
                  <td>5000m</td>
                  <td>15'11"82</td>
                </tr>
                <tr>
                  <td>4/25(日)</td>
                  <td>兵庫リレーカーニバル</td>
                  <td>1500m</td>
                  <td>4'10"14</td>
                </tr>
                <tr>
                  <td rowspan="2">4/18(日)</td>
                  <td rowspan="2">兵庫陸上競技春季記録会</td>
                  <td>800m</td>
                  <td>2'06"60</td>
                </tr>
                <tr>
                  <td>3000m</td>
                  <td>9'11"39</td>
                </tr>
                <tr>
                  <td>4/10(土)</td>
                  <td>金栗記念選抜陸上中長距離大会</td>
                  <td>1500m</td>
                  <td>4'09"31</td>
                </tr>
                <tr>
                  <td>4/4(日)</td>
                  <td rowspan="2">ミドルディスタンス・チャレンジ</td>
                  <td>1500m</td>
                  <td>4'13"09</td>
                </tr>
                <tr>
                  <td>4/3(土)</td>
                  <td>3000m</td>
                  <td>8'57"27</td>
                </tr>
                <tr>
                  <td>3/29(月)</td>
                  <td>明石市春季陸上競技大会</td>
                  <td>3000m</td>
                  <td>9'09"57</td>
                </tr>
                <tr>
                  <td rowspan="2">3/21(日)</td>
                  <td rowspan="2">屋外高松UD記録会</td>
                  <td>800m</td>
                  <td>2'09"10</td>
                </tr>
                <tr>
                  <td>1500m</td>
                  <td>4'15"18</td>
                </tr>
                <tr>
                  <td>2/27(土)</td>
                  <td>日本選手権クロスカントリー競走</td>
                  <td>8km</td>
                  <td>26'22"</td>
                </tr>
                <tr>
                  <td>1/17(水)</td>
                  <td>京都女子駅伝 中長距離競技会</td>
                  <td>10000m</td>
                  <td>31'59"89</td>
                </tr>
              </tbody>
            </table>
          <p class="headline mt-4"><a name="2020">2020</a></p>
            <table class="table table-bordered table-striped">
              <thead>
                <tr>
                  <th scope="col">日付</th>
                  <th scope="col">大会名</th>
                  <th scope="col">種目</th>
                  <th scope="col">タイム</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowspan="3">12/27(日)</td>
                  <td rowspan="3">川内杯栗橋関所マラソン</td>
                  <td>10km</td>
                  <td>32'07"</td>
                </tr>
              </tbody>
            </table>

          </div>
        </v-card>
        <Adsense v-if="rendered" style="display:block" data-ad-client="ca-pub-7941378059940304" data-ad-slot="6031307376" data-ad-format="auto" data-full-width-responsive="true">
        </Adsense>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import PcScheduleTable from '@/components/schedule/pc/PcScheduleTable.vue'; // @ is an alias to /src
import SpScheduleTable from '@/components/schedule/sp/SpScheduleTable.vue'; // @ is an alias to /src
import Pagination from '@/components/schedule/Pagination.vue';

@Component({
  components: {
    SpScheduleTable,
    PcScheduleTable,
    Pagination,
  },
})
export default class OdaField extends Vue {
  private rendered: boolean = false;
  mounted() {
    this.$store.commit('changeStadiumId', 'nVfuSmsj9cULg3712chv');
    this.$store.dispatch('retrieveScheduleData').then(() => {
      this.rendered = true;
    });
  }
}
</script>

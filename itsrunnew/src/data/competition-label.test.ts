import { describe, expect, it } from 'vitest';
import { competitionLabel } from './competition-label';
import honda from './ojiro-honda-results.json';
import mashiko from './yota-mashiko-results.json';
import niizuma from './haruki-niizuma-results.json';
import nozomi from './nozomi-results.json';
import ryuji from './ryuji-results.json';

describe('Japanese archive competition names', () => {
  it('translates all English competition names in the five published datasets', () => {
    for (const race of [...honda, ...mashiko, ...niizuma, ...nozomi, ...ryuji]) {
      const label = competitionLabel(race.competition);
      expect(label, race.competition).toMatch(/[ぁ-んァ-ヶ一-龯]/);
      expect(label, race.competition).not.toMatch(/Championships|Athletics|School|University|Stadium|Meeting|(?:st|nd|rd|th) /);
    }
  });
  it('distinguishes NCG from the NSSU distance meet and preserves editions', () => {
    expect(competitionLabel('16th NITTAIDAI Challenge Games, NITTAIDAI Athletic Stadium, Yokohama')).toBe('第16回日体大チャレンジゲームズ');
    expect(competitionLabel('297th Nippon Sport Science University Long Distance Competition')).toBe('第297回日本体育大学長距離競技会');
  });
  it('translates the entire name without English location or category suffixes', () => {
    expect(competitionLabel('2024 Fukuoka High School Athletics Championships, Hakatanomori Athletic Stadium, Fukuoka')).toBe('2024年 全国高等学校陸上競技対校選手権大会 福岡県予選会');
    expect(competitionLabel('World Athletics U20 Championships, Hayward Field, Eugene, OR')).toBe('世界U20陸上競技選手権大会');
    expect(competitionLabel('46th World Athletics Cross Country Championships, Tallahassee, FL - U20 Events')).toBe('第46回世界クロスカントリー選手権大会（U20）');
  });
  it('preserves already Japanese and unknown source names without guessing', () => {
    expect(competitionLabel('第45回日本海駅伝競走大会')).toBe('第45回日本海駅伝競走大会');
    expect(competitionLabel('A future meet')).toBe('A future meet');
  });
});

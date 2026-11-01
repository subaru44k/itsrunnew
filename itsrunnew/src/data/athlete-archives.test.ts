import { describe, expect, it } from 'vitest';
import { athletes } from './athlete-archives';
import ekidenEvidence from '../../../research/athlete-archives/ekiden-source-evidence.json';

describe('athlete archive source data', () => {
  for (const [id, athlete] of Object.entries(athletes)) {
    it(`${id} preserves dated, distinct races and valid official sources`, () => {
      const keys = athlete.results.map(race => `${race.date}|${race.competition}|${race.event}|${race.round}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(athlete.results.map(race => race.date)).toEqual(athlete.results.map(race => race.date).sort().reverse());
      for (const race of athlete.results) {
        expect(race.date).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
        expect(race.mark).toBeTruthy();
        if (race.ekiden) {
          expect(Number.isInteger(race.ekiden.rank) && race.ekiden.rank > 0).toBe(true);
          expect(race.ekiden.section).toBeGreaterThan(0);
          expect(race.ekiden.distanceKm).toBeGreaterThan(0);
          expect(race.ekiden.team).toBeTruthy();
          expect(race.event).toBe('Ekiden');
          expect(race.place).toBe('');
          expect(ekidenEvidence.some(source => source.records.some(record => record.athlete === id && record.date === race.date && record.section === race.ekiden?.section && record.mark === race.mark && record.sectionRank === race.ekiden?.rank))).toBe(true);
        } else expect(race.sourceUrl).toMatch(/^https:\/\/worldathletics\.org\/(competition\/calendar-results\/results\/\d+\?eventId=\d+|athletes\/_\/\d+)$/);
      }
    });
  }
  it('preserves tied stage winners and their stage distance without using the cumulative time', () => {
    const race = athletes['yota-mashiko'].results.find(race => race.date === '2026-11-01');
    expect(race).toMatchObject({ mark: '30:51', place: '', ekiden: { section: 2, distanceKm: 11.1, rank: 1, rankTied: true, record: '区間新記録' } });
  });
  it('keeps slow results and distinguishes stage rank from team position', () => {
    const race = athletes['yota-mashiko'].results.find(race => race.date === '2025-03-23');
    expect(race).toMatchObject({ mark: '30:53', ekiden: { section: 4, distanceKm: 9.1, rank: 75 } });
    expect(athletes['ojiro-honda'].results.find(race => race.date === '2023-12-24')).toMatchObject({ mark: '8:30', ekiden: { rank: 10, section: 2, distanceKm: 3 } });
  });
  it('keeps Honda’s 2026 Japanese Championships heat and final separate', () => {
    const races = athletes['ojiro-honda'].results.filter(race => race.competitionId === '7237909' && race.event === '1500 Metres');
    expect(races.map(race => race.mark).sort()).toEqual(['3:37.53', '3:40.49']);
  });
  it('identifies Niizuma as Haruki and retains historical U16 results without broken null links', () => {
    expect(athletes['haruki-niizuma'].worldAthleticsId).toBe(15005774);
    const races = athletes['haruki-niizuma'].results.filter(race => race.date === '2021-10-22');
    expect(races.map(race => race.mark).sort()).toEqual(['2:32.83', '2:33.10']);
    expect(races.every(race => race.sourceUrl.endsWith('/15005774'))).toBe(true);
  });
  it('preserves Mashiko’s road result as a different discipline from track', () => {
    expect(athletes['yota-mashiko'].results).toContainEqual(expect.objectContaining({ date: '2026-09-19', event: '5 Kilometres Road', mark: '13:50', place: '40.' }));
  });
});

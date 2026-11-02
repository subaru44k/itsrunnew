import regionalResults from './regional-results.json';
import ekidenResults from './ekiden-results.json';
import OjiroHondaResults from './ojiro-honda-results.json';
import YotaMashikoResults from './yota-mashiko-results.json';
import HarukiNiizumaResults from './haruki-niizuma-results.json';

export type ArchiveRace = {
  date: string;
  competition: string;
  event: string;
  round: string;
  place: string;
  mark: string;
  venue: string;
  country: string;
  indoor: boolean;
  sourceUrl: string;
  regionalSourceId?: string;
  competitionId?: string | null;
  eventId?: string | null;
  ekiden?: {
    section: number;
    distanceKm: number;
    rank: number;
    team: string;
    rankTied?: boolean;
    record?: string;
  };
};

function withSupplementalResults(id: keyof typeof ekidenResults, trackResults: ArchiveRace[]): ArchiveRace[] {
  return [...trackResults, ...regionalResults[id], ...ekidenResults[id]].sort((a, b) => b.date.localeCompare(a.date));
}

export const athletes = {
  'ojiro-honda': { name: '本田桜二郎', nameEn: 'Ojiro Honda', worldAthleticsId: 15103718, results: withSupplementalResults('ojiro-honda', OjiroHondaResults) },
  'yota-mashiko': { name: '増子陽太', nameEn: 'Yota Mashiko', worldAthleticsId: 15050329, results: withSupplementalResults('yota-mashiko', YotaMashikoResults) },
  'haruki-niizuma': { name: '新妻遼己', nameEn: 'Haruki Niizuma', worldAthleticsId: 15005774, results: withSupplementalResults('haruki-niizuma', HarukiNiizumaResults) },
} as const;

export type AthleteId = keyof typeof athletes;

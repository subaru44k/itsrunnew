import { describe, expect, it } from 'vitest';
import { tracks } from './tracks';
import { courseById, isRunningCourse, matchesPlaceFilters, nearestCourses, placePath, runningCourses, trainingPlaces } from './running-courses';

describe('running courses alongside scheduled tracks', () => {
  it('keeps course IDs outside the scheduled track dataset and requires evidence for published facts', () => {
    expect(runningCourses.length).toBeGreaterThan(0);
    expect(new Set(trainingPlaces.map(place => place.id)).size).toBe(trainingPlaces.length);
    for (const course of runningCourses) {
      expect(tracks.some(track => track.id === course.id)).toBe(false);
      expect(course).not.toHaveProperty('individualUse');
      expect(course).not.toHaveProperty('availability');
      expect(course.lapMeters.length).toBeGreaterThan(0);
      expect(course.lapMeters.every(length => Number.isFinite(length) && length > 0)).toBe(true);
      expect(course.location.latitude).toBeGreaterThan(20);
      expect(course.location.latitude).toBeLessThan(50);
      expect(course.location.longitude).toBeGreaterThan(120);
      expect(course.location.longitude).toBeLessThan(150);
      const evidenced = new Set(course.sources.flatMap(source => source.fields));
      for (const field of ['name', 'location', 'lapMeters']) expect(evidenced.has(field), `${course.id}: ${field}`).toBe(true);
      for (const field of ['surface', 'hours', 'crossings', 'distanceMarkersMeters'] as const) {
        if (course[field] != null) expect(evidenced.has(field), `${course.id}: ${field}`).toBe(true);
      }
      if (course.rules.length) expect(evidenced.has('rules')).toBe(true);
      for (const source of course.sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(source.fields.length).toBeGreaterThan(0);
      }
    }
  });

  it('filters by place type without imposing a lap distance', () => {
    const wako = courseById('wako-jurin-jogging')!;
    expect(matchesPlaceFilters(wako, 'course')).toBe(true);
    expect(matchesPlaceFilters(wako, 'track')).toBe(false);
    expect(matchesPlaceFilters(wako, 'all')).toBe(true);
    expect(matchesPlaceFilters(tracks[0], 'track')).toBe(true);
  });

  it('offers local loops without replacing confirmed track availability or advertising distant alternatives', () => {
    const oizumi = tracks.find(track => track.id.includes('oizumi'))!;
    const nearby = nearestCourses(oizumi.location);
    expect(nearby[0].course.id).toBe('wako-jurin-jogging');
    expect(nearby.every(item => item.distance <= 15)).toBe(true);
    expect(nearestCourses({ ...oizumi.location, latitude: 34.7, longitude: 135.5 })).toEqual([]);
    expect(nearestCourses(runningCourses[0].location, runningCourses[0].id).some(item => item.course.id === runningCourses[0].id)).toBe(false);
    expect(placePath(runningCourses[0], 'en')).toBe(`/en/courses/${runningCourses[0].id}`);
    expect(placePath(tracks[0], 'ja')).toBe(`/tracks/${tracks[0].id}`);
    expect(courseById(['wako-jurin-jogging'])).toBeNull();
    expect(courseById('unlisted')).toBeNull();
  });
});

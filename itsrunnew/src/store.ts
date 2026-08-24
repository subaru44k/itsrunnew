import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import TimeContainerFactory from './model/TimeContainerFactory';

const factory = new TimeContainerFactory();

export const useAppStore = defineStore('app', () => {
  const weekIndex = ref(0);
  const locale = ref<'ja' | 'en'>('ja');
  const targetTimeIndex = ref(0);
  const targetTimes = ref(factory.getTimeContainerSet(0));

  const dateList = computed(() => {
    const activeLocale = locale.value === 'ja' ? 'ja' : 'en';
    return Array.from({ length: 7 }, (_, index) =>
      dayjs().locale(activeLocale).add(weekIndex.value * 7 + index, 'day').format('MM/DD(ddd)'),
    );
  });
  const timeRange = ['00:00', '00:00', '00:00'];
  const statusArray = Array.from({ length: 7 }, () => [0, 0, 0]);

  function previousWeek() {
    weekIndex.value -= 1;
  }

  function nextWeek() {
    weekIndex.value += 1;
  }

  function setLocale(value: 'ja' | 'en') {
    locale.value = value;
  }

  function changeTargetTime(index: number) {
    targetTimeIndex.value = index;
    targetTimes.value = factory.getTimeContainerSet(index);
  }

  return {
    weekIndex,
    locale,
    targetTimeIndex,
    targetTimes,
    dateList,
    timeRange,
    statusArray,
    previousWeek,
    nextWeek,
    setLocale,
    changeTargetTime,
  };
});

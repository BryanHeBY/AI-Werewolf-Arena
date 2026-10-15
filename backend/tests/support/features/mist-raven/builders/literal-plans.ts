/**
 * Builds original mist-raven test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { ActionWindow } from "../../../../../src/domain";
import type { MistRecordVariant } from "./board";

type NightPlan = {
  dream: number[];
  knife: Array<number | null>;
  snake: Array<number | null>;
  extra: Array<number | null>;
  exile: number[];
  circle: number[] | null;
  blast?: { day: number; window: ActionWindow };
  doubleBadge?: boolean;
  parallelBlast?: boolean;
  blastRound?: number;
};

const blastPlan = (window: ActionWindow): NightPlan => ({
  dream: [8, 6, 7],
  knife: [5, 11, 6],
  snake: [null, null, 6],
  extra: [null, null, 3],
  exile: [12, 12, 9],
  circle: [5, 6, 11],
  blast: { day: 1, window },
});

export const manualPlans: Record<MistRecordVariant, NightPlan> = {
  linked: {
    dream: [8, 5, 5],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, 3, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "saved-dreamer": {
    dream: [8, 5, 7],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, 5, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "protected-heal": {
    dream: [5, 8, 5],
    knife: [5, 11, 6],
    snake: [5, null, null],
    extra: [null, null, 3],
    exile: [10, 12, 9],
    circle: [5, 6, 11],
  },
  draw: {
    dream: [8, 5, 5],
    knife: [null, 3, 6],
    snake: [null, 3, null],
    extra: [null, 3, null],
    exile: [12, 10, 9],
    circle: [10, 11, 12],
  },
  "pure-saved-dreamer": {
    dream: [8, 5, 7],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, null, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "consecutive-heal": {
    dream: [5, 5, 7],
    knife: [11, 5, 6],
    snake: [null, 5, null],
    extra: [null, null, 3],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "ordinary-double": {
    dream: [8, 5, 7],
    knife: [11, 6, 8],
    snake: [null, 6, null],
    extra: [null, 6, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "mixed-order": {
    dream: [5, 5, 5],
    knife: [11, 3, 6],
    snake: [null, 3, null],
    extra: [null, 3, null],
    exile: [12, 10, 9],
    circle: [5, 6, 11],
  },
  "self-heal": {
    dream: [8, 5, 7],
    knife: [1, 11, 6],
    snake: [1, null, null],
    extra: [null, null, 3],
    exile: [12, 10, 9],
    circle: [1, 6, 11],
  },
  "blast-pre-election": blastPlan(ActionWindow.OnPreElection),
  "blast-daybreak": blastPlan(ActionWindow.OnDaybreak),
  "blast-speech-gap": blastPlan(ActionWindow.OnPerSpeechGap),
  "blast-pre-vote": blastPlan(ActionWindow.OnPreVote),
  "blast-raw-target": {
    ...blastPlan(ActionWindow.OnPerSpeechGap),
    circle: [10, 6, 11],
    knife: [10, 11, 6],
  },
  "blast-badge-chain": { ...blastPlan(ActionWindow.OnPerSpeechGap), doubleBadge: true },
  "blast-parallel": { ...blastPlan(ActionWindow.OnPerSpeechGap), parallelBlast: true },
  "blast-parallel-raw-loser": {
    ...blastPlan(ActionWindow.OnPerSpeechGap),
    parallelBlast: true,
    knife: [11, 12, 6],
    exile: [12, 8, 9],
  },
  "blast-parallel-second-gap": {
    ...blastPlan(ActionWindow.OnPerSpeechGap),
    parallelBlast: true,
    blastRound: 2,
    knife: [11, 12, 6],
    exile: [12, 8, 9],
  },
  "blast-last-wolf": {
    dream: [8, 7, 6],
    knife: [11, 9, 2],
    snake: [null, null, 2],
    extra: [null, null, null],
    exile: [12, 12, 9],
    circle: null,
    blast: { day: 3, window: ActionWindow.OnDaybreak },
  },
  "last-villager-pass": {
    dream: [1, 2, 1],
    knife: [5, 7, 8],
    snake: [null, null, null],
    extra: [null, null, null],
    exile: [6, 4, 12],
    circle: [5, 6, 7],
  },
  "last-villager-heal": {
    dream: [1, 2, 1, 2],
    knife: [5, 7, 8, 8],
    snake: [null, null, 8, null],
    extra: [null, null, null, null],
    exile: [6, 4, 12, 12],
    circle: [5, 6, 7],
  },
  "last-god": {
    dream: [5, 5, 5],
    knife: [2, 4, 1],
    snake: [null, null, null],
    extra: [null, null, null],
    exile: [3, 6, 12],
    circle: [2, 4, 1],
  },
  "last-god-illegal-self": {
    dream: [5, 5, 5],
    knife: [2, 4, 1],
    snake: [null, null, 1],
    extra: [null, null, null],
    exile: [3, 6, 12],
    circle: [2, 4, 1],
  },
};

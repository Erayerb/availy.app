import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_KEPT_PAGES, openPages, type History } from '../src/lib/navigation.ts';

type R = { name: string; id: number; venue?: number };
const r = (name: string, id: number, venue?: number): R => ({ name, id, venue });
const keys = (h: History<R>, visited: string[]) => openPages(h, ['home', 'map'], visited).map((p) => p.key);

test('a tab is one page however often it is opened; other pages one each', () => {
  const h: History<R> = { current: r('detail', 4, 2), stack: [r('home', 1), r('detail', 2, 1), r('home', 3)] };
  assert.deepEqual(keys(h, ['home']), ['tab:home', 'page:2', 'page:4']);
});

test('a visited tab stays open without being in the history', () => {
  assert.deepEqual(keys({ current: r('home', 1), stack: [] }, ['home', 'map']), ['tab:home', 'tab:map']);
});

test('only the latest pages of a long history stay open', () => {
  const stack = Array.from({ length: 20 }, (_, i) => r('detail', i + 1));
  assert.equal(keys({ current: r('detail', 99), stack }, []).length, MAX_KEPT_PAGES + 1);
});

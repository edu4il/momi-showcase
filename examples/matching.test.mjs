import test from 'node:test';
import assert from 'node:assert/strict';
import { pickDoubles } from './matching.mjs';

const roster = (count = 8) => Array.from({ length: count }, (_, i) => ({
  id: String.fromCharCode(65 + i), level: 1, games: 0,
}));

test('fewer games take priority over a closer skill match', () => {
  const players = roster(5);
  players.forEach((p, i) => { p.games = i ? 2 : 0; p.level = i ? 0 : 3; });
  assert.ok(pickDoubles(players).flat().includes('A'));
});

test('resting and reserved players cannot enter the next game', () => {
  const players = roster(6);
  players[0].ready = false;
  players[1].reserved = true;
  assert.deepEqual(new Set(pickDoubles(players).flat()), new Set(['C', 'D', 'E', 'F']));
  players[2].ready = false;
  assert.equal(pickDoubles(players), null);
});

test('nearby skill groups win when participation counts are equal', () => {
  const players = roster();
  players.forEach((p, i) => { p.level = i < 4 ? 0 : 3; });
  const ids = pickDoubles(players).flat();
  assert.equal(new Set(players.filter(p => ids.includes(p.id)).map(p => p.level)).size, 1);
});

test('four players rotate all three partners before repeating', () => {
  const players = roster(4), history = [];
  for (let i = 0; i < 3; i++) history.push(pickDoubles(players, history));
  for (const player of players) {
    const partners = history.flat().filter(team => team.includes(player.id))
      .flatMap(team => team.filter(id => id !== player.id));
    assert.equal(new Set(partners).size, 3);
  }
});

test('eight always-ready players receive equal games after sixteen rounds', () => {
  const players = roster(), history = [];
  for (let round = 0; round < 16; round++) {
    const teams = pickDoubles(players, history);
    const ids = teams.flat();
    assert.equal(new Set(ids).size, 4);
    players.filter(p => ids.includes(p.id)).forEach(p => { p.games++; });
    history.push(teams);
  }
  assert.deepEqual(players.map(p => p.games), Array(8).fill(8));
});

test('invalid IDs, counts, levels and oversized rosters are rejected', () => {
  assert.throws(() => pickDoubles([...roster(4), roster(1)[0]]));
  assert.throws(() => pickDoubles(roster(13)));
  assert.throws(() => pickDoubles([{ ...roster(1)[0], games: -1 }]));
  assert.throws(() => pickDoubles([{ ...roster(1)[0], level: 4 }]));
});

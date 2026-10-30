// Teaching example: one game, at most 12 fictional players, no server or storage.
// level: 0..3; games: completed games plus existing reservations in this example.
export function pickDoubles(players, history = []) {
  if (players.length > 12 || new Set(players.map(p => p.id)).size !== players.length ||
      players.some(p => typeof p.id !== 'string' || !p.id ||
        !Number.isInteger(p.level) || p.level < 0 || p.level > 3 ||
        !Number.isInteger(p.games) || p.games < 0)) {
    throw new Error('Use unique IDs and valid levels and game counts for up to 12 players.');
  }
  const ready = players.filter(p => p.ready !== false && !p.reserved);
  if (ready.length < 4) return null;

  const cutoff = ready.map(p => p.games).sort((a, b) => a - b)[3];
  const eligible = ready.filter(p => p.games <= cutoff);
  const mandatory = ready.filter(p => p.games < cutoff);
  let best;
  for (const four of choose(eligible, 4)) {
    if (!mandatory.every(p => four.includes(p))) continue;
    const [a, b, c, d] = four;
    for (const teams of [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]]) {
      const levels = four.map(p => p.level);
      const partnerGap = teams.reduce((n, [x, y]) => n + Math.abs(x.level - y.level), 0);
      const repeats = teams.reduce((n, pair) => n + history.flat().filter(old =>
        old.length === 2 && pair.every(p => old.includes(p.id))).length, 0);
      const sums = teams.map(team => team.reduce((n, p) => n + p.level, 0));
      const score = [Math.max(...levels) - Math.min(...levels), partnerGap, repeats,
        Math.abs(sums[0] - sums[1])];
      if (!best || compare(score, best.score) < 0) {
        best = { score, teams: teams.map(team => team.map(p => p.id)) };
      }
    }
  }
  return best.teams;
}

function* choose(items, count, start = 0, prefix = []) {
  if (!count) { yield prefix; return; }
  for (let i = start; i <= items.length - count; i++) {
    yield* choose(items, count - 1, i + 1, [...prefix, items[i]]);
  }
}

function compare(left, right) {
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

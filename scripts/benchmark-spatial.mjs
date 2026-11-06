import { SpatialIndex } from '../src/core/SpatialIndex.ts';
import { segmentCircle } from '../src/world/raycast.ts';
import { createRng } from '../src/core/rng.ts';
const rng = createRng(789),
  bodies = Array.from({ length: 250 }, (_, id) => ({
    id,
    x: rng.next() * 2400 - 1200,
    y: rng.next() * 2400 - 1200,
    r: 8 + rng.next() * 24,
  }));
const shots = Array.from({ length: 400 }, () => {
  const x = rng.next() * 2400 - 1200,
    y = rng.next() * 2400 - 1200;
  return { x, y, ex: x + rng.next() * 400 - 200, ey: y + rng.next() * 400 - 200 };
});
const grid = new SpatialIndex(),
  allIds = bodies.map((b) => b.id);
let checks = 0;
function run(indexed) {
  let hits = 0;
  checks = 0;
  if (indexed) {
    grid.clear();
    for (const b of bodies) grid.insert(b.id, b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
  }
  for (const s of shots) {
    const ids = indexed
      ? grid.query(Math.min(s.x, s.ex), Math.min(s.y, s.ey), Math.max(s.x, s.ex), Math.max(s.y, s.ey))
      : allIds;
    for (const id of ids) {
      checks++;
      const b = bodies[id];
      if (segmentCircle(s.x, s.y, s.ex, s.ey, b.x, b.y, b.r) !== null) hits++;
    }
  }
  return hits;
}
for (let i = 0; i < 5; i++) {
  run(false);
  run(true);
}
const result = {
  fixture: '250 cuerpos, 400 segmentos barridos; semilla 789; incluye reconstrucción del índice',
  node: process.version,
};
for (const indexed of [false, true]) {
  const times = [];
  let hits;
  for (let i = 0; i < 40; i++) {
    const t = performance.now();
    hits = run(indexed);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  result[indexed ? 'indexed' : 'bruteForce'] = {
    medianMs: +times[20].toFixed(3),
    p95Ms: +times[38].toFixed(3),
    checks,
    hits,
  };
}
if (result.indexed.hits !== result.bruteForce.hits) throw Error('Hit mismatch');
console.log(JSON.stringify(result, null, 2));

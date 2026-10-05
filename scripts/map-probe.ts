/**
 * 맵 설계 검증용 물리 시뮬레이션 (렌더링 없음, 게임과 같은 10ms 고정 스텝).
 *
 *   yarn probe [맵번호|all] [구슬수] [시드,시드,...]
 *
 * 맵마다 아래를 잰다.
 *  - 첫/마지막 골인 시각, 끝까지 못 들어온 구슬(걸림)과 그 위치
 *  - 구슬이 장애물 종류(회전체/방울/범퍼/트램펄린)에 닿은 비율 — 장애물이 실제로 쓰이는지
 *  - 마지막 갈림길에서 왼쪽 길로 간 비율, 75% 지점 순위와 최종 순위의 상관(1=역전 없음)
 */
import * as fs from 'node:fs';
import Box2DFactory from 'box2d-wasm';
import { PROGRESS_DELAY, PROGRESS_STEP } from '../src/data/constants';
import { stages } from '../src/data/maps';
import { Box2dPhysics } from '../src/physics-box2d';

function seedRandom(seed: number) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class NodePhysics extends Box2dPhysics {
  onPop?: (entity: any, otherPtr: number) => void;
  async init(): Promise<void> {
    const wasmBinary = fs.readFileSync(new URL('../node_modules/box2d-wasm/dist/umd/Box2D.simd.wasm', import.meta.url));
    const self = this as any;
    self.Box2D = await Box2DFactory({ wasmBinary } as any);
    self.gravity = new self.Box2D.b2Vec2(0, 10);
    self.world = new self.Box2D.b2World(self.gravity);
  }
  /** 방울이 터지는 순간의 접촉을 놓치지 않도록 step 을 그대로 옮기고 훅을 단다 */
  step(deltaSeconds: number): void {
    const self = this as any;
    self.deleteCandidates.forEach((body: any) => self.world.DestroyBody(body));
    self.deleteCandidates = [];
    self.world.Step(deltaSeconds, 6, 2);
    for (let i = self.entities.length - 1; i >= 0; i--) {
      const entity = self.entities[i];
      if (entity.life > 0) {
        const edge = entity.body.GetContactList();
        if (edge.contact?.IsTouching()) {
          this.onPop?.(entity, self.Box2D.getPointer(edge.other));
          self.deleteCandidates.push(entity.body);
          self.entities.splice(i, 1);
        }
      }
    }
  }
}

function kindOf(e: any): string {
  if (e.type === 'kinematic') return 'spinner';
  if (e.shape.type === 'polyline') return 'wall';
  if (e.props.life) return 'bubble';
  if (e.shape.type === 'circle') return e.props.restitution >= 1.1 ? 'bumper' : 'peg';
  return e.props.restitution >= 0.85 ? 'trampoline' : 'plate';
}

const spearman = (a: number[], b: number[]) => {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length);
    idx.forEach(([, i], k) => {
      r[i] = k;
    });
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += (ra[i] - rb[i]) ** 2;
  return n > 2 ? 1 - (6 * d2) / (n * (n * n - 1)) : 1;
};

type Seg = { x1: number; y1: number; x2: number; y2: number };

/** 벽 타기 판정에 쓰는 가파른(수직에서 25° 이내) 정적 선분. 깔때기 같은 완만한 경사는 일부러 타고 내려가게 만든 것이라 제외한다 */
function steepWalls(stage: any): Seg[] {
  const segs: Seg[] = [];
  for (const e of stage.entities) {
    if (e.type !== 'static' || e.shape.type !== 'polyline') continue;
    const pts = e.shape.points as [number, number][];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      if (dy >= 1 && dx <= dy * Math.tan((25 * Math.PI) / 180)) segs.push({ x1, y1: Math.min(y1, y2), x2, y2: Math.max(y1, y2) });
    }
  }
  return segs;
}

function distToSeg(px: number, py: number, s: Seg) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / len2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

/** 마루(구슬 중심)와 벽 사이 거리가 이 값 이하이면 벽에 붙어 있다고 본다 (구슬 반지름 0.25 + 여유 0.35) */
const HUG_DIST = 0.6;
/** 벽에서 떨어져 있어도 이 시간(초) 안에 다시 붙으면 같은 구간으로 이어 센다 */
const HUG_GAP_SEC = 0.15;

async function run(mapIdx: number, n: number, seed: number) {
  seedRandom(seed);
  const stage = stages[mapIdx];
  const p = new NodePhysics();
  await p.init();
  p.createStage(stage);
  const self = p as any;
  const B = self.Box2D;
  const maxLine = Math.ceil(n / 10);
  const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
  for (let order = 0; order < n; order++) {
    p.createMarble(order, 10.25 + (order % 10) * 0.6, maxLine - Math.floor(order / 10) + lineDelta);
  }
  p.start();

  const kinds = stage.entities!.map(kindOf);
  const bodyKind = new Map<number, string>();
  const bodyIdx = new Map<number, number>();
  const perEntity = new Map<number, Set<number>>();
  self.entities.forEach((ent: any, i: number) => {
    bodyKind.set(B.getPointer(ent.body), kinds[i]);
    bodyIdx.set(B.getPointer(ent.body), i);
  });
  const ptrToId = new Map<number, number>();
  for (const [id, body] of Object.entries(self.marbleMap)) ptrToId.set(B.getPointer(body), Number(id));

  const touched = new Map<string, Set<number>>();
  const mark = (kind: string, id: number) => {
    if (!touched.has(kind)) touched.set(kind, new Set());
    touched.get(kind)!.add(id);
  };
  p.onPop = (ent: any, otherPtr: number) => {
    const id = ptrToId.get(otherPtr);
    if (id !== undefined) mark('bubble', id);
  };

  const walls = steepWalls(stage);
  const bestY = new Array(n).fill(-Infinity);
  const noProgressMs = new Array(n).fill(0);
  let nudges = 0;
  const prevY = new Array(n).fill(NaN);
  const hugRun = new Array(n).fill(0); // 지금 이어지는 벽 타기 낙하 거리
  const hugGap = new Array(n).fill(0); // 벽에서 떨어진 시간
  let hugTotal = 0;
  let fallTotal = 0;
  let hugLongest = 0;
  let hugLongestAt = 0;
  const hugBuckets = new Map<number, number>();
  const hugSpots = new Map<string, number>();
  const alive = new Set<number>([...Array(n).keys()]);
  const early = new Array(n).fill(NaN);
  const fin = new Array(n).fill(NaN);
  const laneX = new Array(n).fill(NaN);
  const pending: { id: number; at: number }[] = [];
  // 갈림길 지붕(꼭대기 y)에 닿은 순간의 순위와 최종 순위를 비교한다
  const roof = stage.entities!
    .map((e: any) => e.shape.points as [number, number][] | undefined)
    .find((pts) => pts && pts.length === 3 && pts[0][1] === pts[2][1] && pts[1][1] < pts[0][1] && pts[1][0] === 13);
  const checkY = roof ? roof[1][1] : stage.goalY * 0.75;
  let slow: string[] = [];
  const trace: { id: number; t: number; x: number; y: number }[] = [];
  let lastTrace = -1;
  const trace2: { id: number; t: number; x: number; y: number }[] = [];
  let lastTrace2 = -1;
  const laneY = Number(process.env.LANEY ?? 0);
  const laneSeen: number[] = [];
  let t = 0;
  while (alive.size > 0 && t < 300) {
    p.step(0.01);
    t += 0.01;
    while (pending.length && pending[0].at <= t) p.removeMarble(pending.shift()!.id);
    for (const ent of self.entities) {
      const kind = bodyKind.get(B.getPointer(ent.body));
      if (kind !== 'spinner' && kind !== 'bumper' && kind !== 'trampoline') continue;
      let e = ent.body.GetContactList();
      while (B.getPointer(e)) {
        if (e.contact.IsTouching()) {
          const id = ptrToId.get(B.getPointer(e.other));
          if (id !== undefined) {
            mark(kind, id);
            const bi = bodyIdx.get(B.getPointer(ent.body))!;
            if (!perEntity.has(bi)) perEntity.set(bi, new Set());
            perEntity.get(bi)!.add(id);
          }
        }
        e = e.next;
      }
    }
    if (slow.length === 0 && t >= Number(process.env.SNAP ?? 70) && alive.size > 0) {
      slow = [...alive].map((id) => {
        const q = p.getMarblePosition(id);
        return `(${q.x.toFixed(1)}, ${q.y.toFixed(1)})`;
      });
    }
    if (process.env.STUCKTRACE && t - lastTrace2 >= 20) {
      lastTrace2 = t;
      for (const id of alive) {
        const q = p.getMarblePosition(id);
        trace2.push({ id, t, x: q.x, y: q.y });
      }
    }
    if (process.env.TRACE && t - lastTrace >= 0.5) {
      lastTrace = t;
      for (const id of alive) {
        const q = p.getMarblePosition(id);
        trace.push({ id, t, x: q.x, y: q.y });
      }
    }
    for (const id of alive) {
      const q = p.getMarblePosition(id);
      // 게임의 Marble 진행 감시와 같은 규칙
      if (q.y > bestY[id] + PROGRESS_STEP) {
        bestY[id] = q.y;
        noProgressMs[id] = 0;
      } else if ((noProgressMs[id] += 10) > PROGRESS_DELAY) {
        p.nudgeMarbleDown(id);
        nudges++;
        if (process.env.NUDGEDBG) console.log(`   밀어냄 #${id} t=${t.toFixed(0)}s (${q.x.toFixed(1)}, ${q.y.toFixed(1)})`);
        noProgressMs[id] = 0;
      }
      const dy = Number.isNaN(prevY[id]) ? 0 : q.y - prevY[id];
      prevY[id] = q.y;
      // 초속 3 이상으로 내려가는 구간만 센다. 구슬 더미 위에서 비비적대는 미세한 움직임은 제외하고, 위로 튕기면 연속 구간을 끊는다
      if (dy < -0.03) hugRun[id] = 0;
      if (dy > 0.03 && q.y >= (stage.forkY ?? -Infinity)) {
        fallTotal += dy;
        let near = false;
        for (const w of walls) {
          if (q.y < w.y1 - 1 || q.y > w.y2 + 1) continue;
          if (distToSeg(q.x, q.y, w) <= HUG_DIST) {
            near = true;
            break;
          }
        }
        if (near) {
          hugTotal += dy;
          hugRun[id] += dy;
          hugGap[id] = 0;
          const bucket = Math.floor(q.y / 10) * 10;
          const wallKey = `x${(Math.round(q.x * 2) / 2).toFixed(1)}_y${bucket}`;
          hugSpots.set(wallKey, (hugSpots.get(wallKey) ?? 0) + dy);
          hugBuckets.set(bucket, (hugBuckets.get(bucket) ?? 0) + dy);
          if (hugRun[id] > hugLongest) {
            hugLongest = hugRun[id];
            hugLongestAt = q.y;
            if (process.env.HUGDBG) console.log('   긴 벽타기', `id${id}`, `t=${t.toFixed(1)}`, `x=${q.x.toFixed(2)}`, `y=${q.y.toFixed(1)}`, `run=${hugRun[id].toFixed(1)}`);
          }
        } else {
          hugGap[id] += 0.01;
          if (hugGap[id] > HUG_GAP_SEC) hugRun[id] = 0;
        }
      }
      if (laneY && laneSeen[id] === undefined && q.y >= laneY) laneSeen[id] = q.x;
      if (Number.isNaN(early[id]) && q.y >= checkY) early[id] = t;
      if (Number.isNaN(laneX[id]) && q.y >= stage.goalY - 10) laneX[id] = q.x;
      if (q.y > stage.goalY) {
        fin[id] = t;
        alive.delete(id);
        pending.push({ id, at: t + 0.5 });
      }
    }
  }
  if (process.env.PER) {
    for (const [bi, set] of [...perEntity.entries()].sort((a, b) => (stage.entities![a[0]] as any).position.y - (stage.entities![b[0]] as any).position.y)) {
      const en = stage.entities![bi] as any;
      console.log(`   ${kinds[bi]} (${en.position.x.toFixed(1)}, ${en.position.y.toFixed(1)}) ${set.size}/${n}`);
    }
  }
  if (process.env.TRACE) {
    const first = fin.indexOf(Math.min(...fin.filter((v) => !Number.isNaN(v))));
    console.log(`   첫 골인 구슬 #${first} 경로:`, trace.filter((r) => r.id === first).map((r) => `${r.t.toFixed(1)}s(${r.x.toFixed(1)},${r.y.toFixed(0)})`).join(' '));
  }
  if (process.env.STUCKTRACE && alive.size) {
    for (const id of alive) {
      const rows = trace2.filter((r) => r.id === id).slice(-8);
      const body = self.marbleMap[id];
      let ce = body.GetContactList();
      const touching: string[] = [];
      while (B.getPointer(ce)) {
        if (ce.contact.IsTouching()) {
          const ob = ce.other;
          const pos = ob.GetPosition();
          touching.push(`${bodyKind.get(B.getPointer(ob)) ?? 'marble'}@(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`);
        }
        ce = ce.next;
      }
      console.log(`   접촉 중: ${touching.join(' ') || '없음'}`);
      console.log(`   걸린 구슬 #${id} 마지막 경로:`, rows.map((r) => `${r.t.toFixed(0)}s(${r.x.toFixed(2)},${r.y.toFixed(2)})`).join(' '));
    }
  }
  const stuck = [...alive].map((id) => {
    const q = p.getMarblePosition(id);
    return `(${q.x.toFixed(1)}, ${q.y.toFixed(1)})`;
  });
  const done = fin.filter((v) => !Number.isNaN(v));
  const lanes = laneX.filter((v) => !Number.isNaN(v));
  return {
    title: stage.title,
    first: Math.min(...done),
    last: Math.max(...done),
    stuck,
    nudges,
    hug: fallTotal ? hugTotal / fallTotal : 0,
    hugLongest,
    hugLongestAt,
    hugSpots: [...hugSpots.entries()].map(([k, d]) => [k, d / Math.max(1, fallTotal)] as [string, number]),
    hugBuckets: [...hugBuckets.entries()].map(([y, d]) => [y, d / Math.max(1, fallTotal)] as [number, number]),
    slow,
    lanes: laneSeen.filter((x) => x !== undefined),
    touched,
    left: lanes.filter((x) => x < 13).length / Math.max(1, lanes.length),
    corr: fin.some(Number.isNaN) || early.some(Number.isNaN) ? NaN : spearman(early, fin),
  };
}

/** 맵 검수 기준. 하나라도 어기면 --check 가 실패한다 */
const LIMITS = {
  /** 낙하 거리 중 벽에 붙어 내려온 비율 상한 */
  hugFraction: 0.2,
  /** 한 구슬이 벽에 붙은 채 이어서 내려온 최대 거리 상한 (맵 높이 단위) */
  hugRun: 12,
};

(async () => {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const [which = 'all', nArg = '30', seedsArg = '1,2,3'] = args.filter((a) => !a.startsWith('--'));
  const n = Number(nArg);
  const seeds = seedsArg.split(',').map(Number);
  const maps = which === 'all' ? stages.map((_, i) => i) : [Number(which)];
  let failed = false;
  for (const m of maps) {
    let first = 0;
    let last = 0;
    let left = 0;
    let corr = 0;
    let corrN = 0;
    let hug = 0;
    let hugLongest = 0;
    let hugLongestAt = 0;
    let title = '';
    let nudges = 0;
    const stuck: string[] = [];
    const slowAt: string[] = [];
    const laneXs: number[] = [];
    const touch = new Map<string, number>();
    const buckets = new Map<number, number>();
    const spots = new Map<string, number>();
    for (const s of seeds) {
      const r = await run(m, n, s);
      title = r.title;
      first += r.first / seeds.length;
      last += r.last / seeds.length;
      left += r.left / seeds.length;
      hug += r.hug / seeds.length;
      nudges += r.nudges;
      if (r.hugLongest > hugLongest) {
        hugLongest = r.hugLongest;
        hugLongestAt = r.hugLongestAt;
      }
      for (const [k, f] of r.hugSpots) spots.set(k, (spots.get(k) ?? 0) + f / seeds.length);
      for (const [y, f] of r.hugBuckets) buckets.set(y, (buckets.get(y) ?? 0) + f / seeds.length);
      if (!Number.isNaN(r.corr)) {
        corr += r.corr;
        corrN++;
      }
      r.stuck.forEach((q) => stuck.push(`seed${s}${q}`));
      r.slow.forEach((q) => slowAt.push(`seed${s}${q}`));
      r.lanes.forEach((x) => laneXs.push(x));
      for (const [k, v] of r.touched) touch.set(k, (touch.get(k) ?? 0) + v.size / n / seeds.length);
    }
    if (slowAt.length) console.log(`   70초에도 남은 구슬: ${slowAt.slice(0, 6).join(' ')}`);
    if (laneXs.length) {
      const c = (f: (x: number) => boolean) => Math.round((laneXs.filter(f).length / laneXs.length) * 100);
      console.log(`   LANEY=${process.env.LANEY} 구간 x<10: ${c((x) => x < 10)}%  10~16: ${c((x) => x >= 10 && x < 16)}%  >16: ${c((x) => x >= 16)}%`);
    }
    const pct = (k: string) => `${k}:${Math.round((touch.get(k) ?? 0) * 100)}%`;
    const hot = [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, f]) => f > 0.01)
      .map(([y, f]) => `y${y}~${y + 10}:${(f * 100).toFixed(1)}%`)
      .join(' ');
    console.log(
      `[${m}] ${title} n=${n} first=${first.toFixed(1)}s last=${last.toFixed(1)}s 걸림=${stuck.length}${stuck.length ? ` ${stuck.slice(0, 4).join(' ')}` : ''} | ${['spinner', 'bubble', 'bumper', 'trampoline'].map(pct).join(' ')} | 왼쪽길 ${Math.round(left * 100)}% 상관 ${corrN ? (corr / corrN).toFixed(2) : '-'}`
    );
    const topSpots = [...spots.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, f]) => `${k}:${(f * 100).toFixed(1)}%`)
      .join(' ');
    const hugBad = hug > LIMITS.hugFraction || hugLongest > LIMITS.hugRun;
    console.log(
      `     진행 감시 발동 ${nudges}회 (0 에 가까울수록 좋음)\n     벽 타기: 낙하의 ${(hug * 100).toFixed(1)}% (기준 ${LIMITS.hugFraction * 100}% 이하), 최장 연속 ${hugLongest.toFixed(1)} @y${hugLongestAt.toFixed(0)} (기준 ${LIMITS.hugRun} 이하) ${hugBad ? '✗ 실패' : '✓'}${hot ? `  · 많이 타는 구간 ${hot}` : ''}${process.env.SPOTS ? `\n     벽 위치별: ${topSpots}` : ''}`
    );
    if (hugBad || stuck.length) failed = true;
  }
  if (check) {
    console.log(failed ? '\n맵 검수 실패: 벽 타기 또는 걸린 구슬이 기준을 넘었습니다. `yarn probe all` 로 상세를 확인하세요.' : '\n맵 검수 통과');
    process.exit(failed ? 1 : 0);
  }
})();

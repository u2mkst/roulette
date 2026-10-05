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
  if (e.shape.type === 'circle') return e.props.restitution >= 1.2 ? 'bumper' : 'peg';
  return e.props.restitution >= 1.1 ? 'trampoline' : 'plate';
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
    if (process.env.TRACE && t - lastTrace >= 0.5) {
      lastTrace = t;
      for (const id of alive) {
        const q = p.getMarblePosition(id);
        trace.push({ id, t, x: q.x, y: q.y });
      }
    }
    for (const id of alive) {
      const q = p.getMarblePosition(id);
      if (laneY && laneSeen[id] === undefined && q.y >= laneY) laneSeen[id] = q.x;
      if (Number.isNaN(early[id]) && q.y >= checkY) early[id] = t;
      if (Number.isNaN(laneX[id]) && q.y >= stage.goalY - 6) laneX[id] = q.x;
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
    slow,
    lanes: laneSeen.filter((x) => x !== undefined),
    touched,
    left: lanes.filter((x) => x < 13).length / Math.max(1, lanes.length),
    corr: fin.some(Number.isNaN) || early.some(Number.isNaN) ? NaN : spearman(early, fin),
  };
}

(async () => {
  const [which = 'all', nArg = '30', seedsArg = '1,2,3'] = process.argv.slice(2);
  const n = Number(nArg);
  const seeds = seedsArg.split(',').map(Number);
  const maps = which === 'all' ? stages.map((_, i) => i) : [Number(which)];
  for (const m of maps) {
    let first = 0;
    let last = 0;
    let left = 0;
    let corr = 0;
    let corrN = 0;
    let title = '';
    const stuck: string[] = [];
    const slowAt: string[] = [];
    const laneXs: number[] = [];
    const touch = new Map<string, number>();
    for (const s of seeds) {
      const r = await run(m, n, s);
      title = r.title;
      first += r.first / seeds.length;
      last += r.last / seeds.length;
      left += r.left / seeds.length;
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
    console.log(
      `[${m}] ${title} n=${n} first=${first.toFixed(1)}s last=${last.toFixed(1)}s 걸림=${stuck.length}${stuck.length ? ` ${stuck.slice(0, 4).join(' ')}` : ''} | ${['spinner', 'bubble', 'bumper', 'trampoline'].map(pct).join(' ')} | 왼쪽길 ${Math.round(left * 100)}% 상관 ${corrN ? (corr / corrN).toFixed(2) : '-'}`
    );
  }
})();

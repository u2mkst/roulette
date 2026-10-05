import type { MapEntity } from '../types/MapEntity.type';
import type { AdBoard, StageDef } from './maps';

/**
 * KST 맵을 만드는 부품들.
 *
 * 구슬은 x 10.25~15.65 에서 태어나므로 맨 위 통로는 x 8~18(중심 13)이다.
 * 모든 맵은 마지막에 같은 "운명의 갈림길"(fork)로 끝난다.
 *
 * 설계하며 배운 규칙(물리 시뮬레이션 `yarn probe` 로 확인):
 *  - 구슬이 벽을 타고 장애물을 피하지 못하게, 장애물 바로 위에 좁은 문(깔때기)이나 막힌 판을 둔다.
 *  - 벽·칸막이와 둥근 장애물 사이 틈은 0.9 이상 띄운다. 0.5~0.9 면 구슬이 끼어 쌓인다.
 *  - 가까운 둥근 장애물 두 개 사이 틈은 0.5 미만이 되면 구슬이 그 위에 올라앉아 안 내려온다.
 *  - 트램펄린·범퍼 탄성은 1.15 이하. 1 을 크게 넘으면 부딪힐 때마다 에너지가 늘어 구슬이 같은 자리를 무한히 튕긴다.
 *    (그래도 못 막은 경우를 위해 Marble 에 진행 감시가 있다)
 */
export const LEFT = 8;
export const RIGHT = 18;
export const CENTER = 13;
const FUNNEL_HEIGHT = 4.5;
const LIP = 0.6;

const solid = { density: 1, angularVelocity: 0, restitution: 0 };

export const poly = (points: [number, number][]): MapEntity => ({
  type: 'static',
  position: { x: 0, y: 0 },
  props: solid,
  shape: { type: 'polyline', rotation: 0, points },
});

export const slope = (x1: number, y1: number, x2: number, y2: number): MapEntity =>
  poly([
    [x1, y1],
    [x2, y2],
  ]);

export const peg = (x: number, y: number, radius = 0.3): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution: 0.6 },
  shape: { type: 'circle', radius },
});

/** 터지는 방울: 한 번 닿으면 사라지면서 구슬을 크게 튕겨 낸다 */
export const bubble = (x: number, y: number, radius = 0.5): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution: 1.5, life: 1 },
  shape: { type: 'circle', radius },
});

/** 범퍼: 안 터지고 계속 튕긴다 */
export const bumper = (x: number, y: number, radius = 0.6): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution: 1.15 },
  shape: { type: 'circle', radius },
});

/** 트램펄린: 기울기 방향(양수면 오른쪽이 낮음)으로 구슬이 튀어 나간다 */
export const trampoline = (x: number, y: number, halfWidth: number, rotation: number, restitution = 1.05): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution },
  shape: { type: 'box', width: halfWidth, height: 0.12, rotation },
});

/** 두 점을 잇는 탄성판 (긴 트램펄린 계단용) */
export const plank = (x1: number, y1: number, x2: number, y2: number, restitution = 0.9): MapEntity =>
  trampoline((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1) / 2, Math.atan2(y2 - y1, x2 - x1), restitution);

/** 회전 막대 */
export const sweeper = (x: number, y: number, halfLength: number, angularVelocity: number): MapEntity => ({
  type: 'kinematic',
  position: { x, y },
  props: { ...solid, angularVelocity },
  shape: { type: 'box', width: halfLength, height: 0.1, rotation: 0 },
});

/** 회전하는 K 마크. 줄기와 위·아래 팔을 한 줄로 이어서 한 몸으로 돈다 */
export const spinningK = (x: number, y: number, s: number, angularVelocity: number): MapEntity => ({
  type: 'kinematic',
  position: { x, y },
  props: { ...solid, angularVelocity },
  shape: {
    type: 'polyline',
    rotation: 0,
    points: [
      [-0.7 * s, -s],
      [-0.7 * s, s],
      [-0.7 * s, 0],
      [0.8 * s, -s],
      [-0.7 * s, 0],
      [0.8 * s, s],
    ],
  },
});

/** 회전하는 십자 바람개비 */
export const windmill = (x: number, y: number, s: number, angularVelocity: number): MapEntity => ({
  type: 'kinematic',
  position: { x, y },
  props: { ...solid, angularVelocity },
  shape: {
    type: 'polyline',
    rotation: 0,
    points: [
      [-s, 0],
      [s, 0],
      [0, 0],
      [0, -s],
      [0, s],
    ],
  },
});

/** 갈림길 느린 길(지그재그)의 선반마다 하나씩 놓는 볼거리 */
export type SlowKit = 'bubbles' | 'bumper' | 'windmill' | 'K' | 'trampoline' | 'pins';

export interface ForkOptions {
  /** 첫 깔때기 문 바로 아래에 놓을 장애물(g 는 문 끝 y) */
  diverter: (g: number) => MapEntity[];
  /** 지그재그 느린 길이 어느 쪽인가. 반대쪽은 곧장 떨어지는 빠른 길 */
  slowSide: 'left' | 'right';
  /** 느린 길 선반 수만큼, 선반마다의 볼거리 */
  slowKit: SlowKit[];
  /** 빠른 길에 놓을 트램펄린 수 (구슬이 쭉 튕겨 나가 시간이 들쭉날쭉해진다) */
  fastPads: number;
}

export class Builder {
  entities: MapEntity[] = [];

  add(...e: MapEntity[]) {
    this.entities.push(...e);
    return this;
  }

  /** 벽(좌우 대칭이 아니어도 된다) */
  walls(left: [number, number][], right: [number, number][]) {
    return this.add(poly(left), poly(right));
  }

  /** x 8~18 직선 통로 */
  chute(bottom: number) {
    return this.walls(
      [
        [LEFT, -300],
        [LEFT, bottom],
      ],
      [
        [RIGHT, -300],
        [RIGHT, bottom],
      ]
    );
  }

  /** 벽에서 문까지 좁아지는 깔때기. top 은 깔때기가 벽에서 시작하는 y, 반환값은 문 끝 y */
  funnel(top: number, gateHalf = 1.1) {
    this.add(
      poly([
        [LEFT, top],
        [CENTER - gateHalf, top + FUNNEL_HEIGHT],
        [CENTER - gateHalf, top + FUNNEL_HEIGHT + LIP],
      ]),
      poly([
        [RIGHT, top],
        [CENTER + gateHalf, top + FUNNEL_HEIGHT],
        [CENTER + gateHalf, top + FUNNEL_HEIGHT + LIP],
      ])
    );
    return top + FUNNEL_HEIGHT + LIP;
  }

  /** 핀을 벽에서 1 이상 띄워 엇갈려 놓은 핀볼판 */
  pegField(top: number, rows: number) {
    for (let r = 0; r < rows; r++) {
      const y = top + r * 1.5;
      // 핀 사이 틈은 1.1 이상: 0.7 정도로 좁으면 구슬 두세 개가 서로 받쳐 틈을 막아 버린다(아치 현상)
      const xs = r % 2 === 0 ? [11.3, 13, 14.7] : [10.45, 12.15, 13.85, 15.55];
      xs.forEach((x) => this.add(peg(x, y)));
    }
    return top + (rows - 1) * 1.5;
  }

  /**
   * 마지막 "운명의 갈림길". 폭 x 8~18 통로(top 에서 벽이 x 8·18)에서 시작한다.
   * 문 아래의 회전 막대가 구슬을 왼쪽/오른쪽으로 거의 반반 갈라 보낸다.
   *  - 느린 길: 지그재그 선반마다 볼거리(방울·범퍼·바람개비·K·트램펄린)가 있다
   *  - 빠른 길: 곧장 떨어지지만 트램펄린이 있어 구슬이 쭉 튕겨 나가 시간이 들쭉날쭉해진다
   * 두 길은 마지막에 한 문(깔때기)으로 합쳐지고, 그 아래 결승선(goalY)을 한곳에서 지난다. 반환값은 goalY.
   */
  fork(top: number, o: ForkOptions) {
    // 레인을 넓게(8.5) 잡아 양쪽 벽 바람개비와 가운데 장애물이 함께 들어가게 한다
    const LANE_LEFT = 4.5;
    const LANE_RIGHT = 21.5;
    const g1 = this.funnel(top);
    this.add(...o.diverter(g1));
    // 두 번째 좁은 문: 앞 장애물에서 옆으로 튕긴 구슬을 다시 가운데로 모아 똑바로 떨어뜨린다
    const g = this.funnel(g1 + 7.5, 0.9);
    // 반대로 도는 막대 두 개를 겹쳐 두면 한쪽으로 쏠리는 경향이 상쇄돼 왼쪽/오른쪽이 고르게 갈린다
    this.add(sweeper(CENTER, g + 1.6, 1.25, 2.4), sweeper(CENTER, g + 3.1, 1.25, -2.9));
    const apex = g + 5.2;

    const SHELF_GAP = 6;
    const slowBottom = apex + 4 + o.slowKit.length * SHELF_GAP;
    // 두 길이 마지막에 한 문으로 합쳐지는 깔때기(mergeTop)와 그 아래 결승 통로
    const mergeTop = slowBottom + 0.5;
    const finishGate = 1.1;
    const goalY = mergeTop + FUNNEL_HEIGHT + LIP + 2.5;
    const m = (x: number) => (o.slowSide === 'left' ? x : 2 * CENTER - x);
    const dir = o.slowSide === 'left' ? 1 : -1;

    // 바깥 벽(레인이 넓어진다), 가운데 칸막이, 지붕
    this.walls(
      [
        [LEFT, top],
        [LEFT, g],
        [LANE_LEFT, g + 3.5],
        [LANE_LEFT, mergeTop],
        [CENTER - finishGate, mergeTop + FUNNEL_HEIGHT],
        [CENTER - finishGate, goalY + 0.75],
      ],
      [
        [RIGHT, top],
        [RIGHT, g],
        [LANE_RIGHT, g + 3.5],
        [LANE_RIGHT, mergeTop],
        [CENTER + finishGate, mergeTop + FUNNEL_HEIGHT],
        [CENTER + finishGate, goalY + 0.75],
      ]
    );
    // 가운데 칸막이. 구슬이 칸막이를 타고 내려오지 못하게 addWallSpinners 가 양옆에 바람개비를 번갈아 붙인다
    this.add(
      slope(CENTER, apex, CENTER, mergeTop),
      poly([
        [CENTER - 2.4, apex + 2.3],
        [CENTER, apex],
        [CENTER + 2.4, apex + 2.3],
      ])
    );

    // 느린 길: 벽 쪽과 칸막이 쪽에 번갈아 틈이 있는 경사판 + 선반마다 볼거리
    o.slowKit.forEach((kit, i) => {
      const y = apex + 4 + i * SHELF_GAP;
      const nearDivider = i % 2 === 0;
      if (nearDivider) this.add(slope(m(LANE_LEFT), y, m(10.3), y + 1.6));
      else this.add(slope(m(CENTER), y, m(LANE_LEFT + 2.7), y + 1.6));
      // 구슬이 틈으로 떨어지는 자리. 칸막이·벽과는 0.9 이상 띄운다
      const kx = m(nearDivider ? 10.9 : LANE_LEFT + 3.2);
      const ky = y + 3.8;
      // 구슬이 틈 쪽으로 미끄러져 나오는 방향의 반대로 튕기도록 트램펄린을 기울인다
      const tilt = (nearDivider ? -0.35 : 0.35) * dir;
      switch (kit) {
        case 'bubbles':
          this.add(bubble(kx - 0.5, ky - 0.2, 0.45), bubble(kx + 0.5, ky + 0.2, 0.45));
          break;
        case 'bumper':
          this.add(bumper(kx, ky, 0.5));
          break;
        case 'windmill':
          this.add(windmill(kx, ky + 0.2, 0.75, (nearDivider ? 2.2 : -2.2) * dir));
          break;
        case 'K':
          this.add(spinningK(kx, ky + 0.2, 0.65, (nearDivider ? -2.4 : 2.4) * dir));
          break;
        case 'trampoline':
          this.add(trampoline(kx, ky + 0.5, 0.9, tilt));
          break;
        case 'pins':
          this.add(peg(kx - 0.6, ky), peg(kx + 0.6, ky + 0.4));
          break;
      }
      // 선반 위에도 방울을 하나 올려 굴러가는 구슬을 한 번 튕긴다
      if (i % 2 === 1) this.add(bubble(m(nearDivider ? 8.4 : 10.5), y + (nearDivider ? 0.9 : 0.9) - 0.5, 0.45));
    });

    // 빠른 길: 트램펄린 몇 개로 쭉 튕겨 나가게 한다 (칸막이·벽과 0.9 이상)
    // 좌표는 오른쪽 길 기준으로 적고, 느린 길이 오른쪽이면 m 이 좌우를 뒤집는다
    const fastX = m;
    for (let j = 0; j < o.fastPads; j++) {
      const py = apex + 7.5 + j * 6.5;
      const px = j % 2 === 0 ? 17.6 : 16.9;
      const tiltF = (j % 2 === 0 ? 0.3 : -0.3) * dir;
      this.add(trampoline(fastX(px), py, 1.2, tiltF, 1.0));
      if (j % 2 === 0) this.add(bubble(fastX(15.9), py - 1.8, 0.45), bubble(fastX(18.6), py - 2.6, 0.45));
    }
    // 바닥 직전의 큰 발사대: 마지막에 한 번 더 크게 튕겨 순서가 뒤집힌다
    this.add(trampoline(fastX(17.25), mergeTop - 3.4, 1.3, 0.22 * dir, 1.0));
    return goalY;
  }
}

/** 벽 바람개비: 크기(팔 길이)와 간격. 팔 끝이 벽에 딱 닿도록 붙인다(틈이 0.35 정도면 구슬이 팔과 벽 사이에 끼어 으깨진다) */
const WALL_SPINNER_SIZE = 1.0;
const WALL_SPINNER_GAP = 0;
const WALL_SPINNER_SPACING = 2.6;
/** 바람개비 팔이 다른 장애물과 이 거리보다 가까우면 구슬이 끼므로 놓지 않는다 */
const WALL_SPINNER_CLEARANCE = 0.4;

const segDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

/** 점에서 장애물 표면까지의 대략적인 거리 (원: 반지름 뺀 값, 상자: 중심선까지, 폴리라인: 선분까지, 회전체: 회전 반경 뺀 값) */
function surfaceDistance(e: MapEntity, x: number, y: number, skip?: MapEntity): number {
  if (e === skip) return Infinity;
  const { position: pos, shape } = e;
  if (shape.type === 'circle') return Math.hypot(pos.x - x, pos.y - y) - shape.radius;
  if (shape.type === 'box') {
    const hx = shape.width;
    if (e.type === 'kinematic') return Math.hypot(pos.x - x, pos.y - y) - hx;
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    return segDistance(x, y, pos.x - hx * cos, pos.y - hx * sin, pos.x + hx * cos, pos.y + hx * sin) - shape.height;
  }
  if (e.type === 'kinematic') {
    const reach = Math.max(...shape.points.map(([px, py]) => Math.hypot(px, py)));
    return Math.hypot(pos.x - x, pos.y - y) - reach;
  }
  let best = Infinity;
  for (let i = 0; i < shape.points.length - 1; i++) {
    const [x1, y1] = shape.points[i];
    const [x2, y2] = shape.points[i + 1];
    best = Math.min(best, segDistance(x, y, pos.x + x1, pos.y + y1, pos.x + x2, pos.y + y2));
  }
  return best;
}

/**
 * 구슬이 벽에 붙어 쭉 내려오는 걸 막는 "벽 바람개비".
 * 길고 가파른 벽(수직에서 25° 이내)마다 작은 바람개비를 벽에 딱 붙여 돌린다. 틈이 없어서
 * 벽을 타고 내려오는 구슬은 돌아가는 팔에 부딪혀 안쪽으로 밀려난다.
 *  - 벽이 통로 중심(x 13)의 왼쪽이면 오른쪽에, 오른쪽이면 왼쪽에 놓고, 중심의 칸막이는 좌우로 번갈아 놓는다.
 *  - 다른 장애물과 가까운 자리는 건너뛴다.
 */
export function addWallSpinners(entities: MapEntity[]): MapEntity[] {
  const spinners: MapEntity[] = [];
  const blocked = (x: number, y: number, wall: MapEntity) =>
    entities.some((e) => surfaceDistance(e, x, y, wall) < WALL_SPINNER_SIZE + WALL_SPINNER_CLEARANCE) ||
    spinners.some((sp) => Math.hypot(sp.position.x - x, sp.position.y - y) < WALL_SPINNER_SPACING * 0.8);
  let flip = 1;
  for (const e of entities) {
    if (e.type !== 'static' || e.shape.type !== 'polyline') continue;
    const pts = e.shape.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      // 가파르고(수직에서 25° 이내) 충분히 긴 벽만
      if (len < 4 || Math.abs(dx) > Math.abs(dy) * Math.tan((25 * Math.PI) / 180)) continue;
      for (let d = 2; d <= len - 2; d += WALL_SPINNER_SPACING) {
        const wx = x1 + (dx * d) / len;
        const wy = y1 + (dy * d) / len;
        // 구슬이 태어나는 맨 위쪽은 비워 둔다. 위로 튕겨 올랐다 떨어지는 구슬을 위해 약간 위(y -12)부터 놓는다
        if (wy < -12) continue;
        // 통로 가운데의 칸막이는 양쪽이 모두 레인이라 좌우를 번갈아 놓되, 한쪽이 선반 등에 막히면 반대쪽에 놓는다
        const isDivider = Math.abs(wx - CENTER) < 0.01;
        const candidates = isDivider ? [flip, -flip] : [wx < CENTER ? 1 : -1];
        for (const side of candidates) {
          const cx = wx + side * (WALL_SPINNER_SIZE + WALL_SPINNER_GAP);
          if (blocked(cx, wy, e)) continue;
          if (isDivider) flip = -side;
          // 벽 쪽 팔이 위로 올라가도록 돌린다(양수=시계 방향, 벽이 왼쪽이면 왼쪽 팔이 올라감). 아래로 내려가면 구슬이 팔과 벽 사이에 끼어 으깨진다
          spinners.push(windmill(cx, wy, WALL_SPINNER_SIZE, side * 2.4));
          break;
        }
      }
    }
  }
  return [...entities, ...spinners];
}

export function stageOf(title: string, goalY: number, entities: MapEntity[], adBoards: AdBoard[]): StageDef {
  return { title, goalY, zoomY: goalY - 4.25, adBoards, entities: addWallSpinners(entities) };
}

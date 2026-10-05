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
 *  - 트램펄린 탄성은 1.25 이하. 더 크면 구슬이 깔때기 안에서 무한히 튕긴다.
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
  props: { ...solid, restitution: 1.3 },
  shape: { type: 'circle', radius },
});

/** 트램펄린: 기울기 방향(양수면 오른쪽이 낮음)으로 구슬이 튀어 나간다 */
export const trampoline = (x: number, y: number, halfWidth: number, rotation: number, restitution = 1.25): MapEntity => ({
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
      const xs = r % 2 === 0 ? [9.8, 11.4, 13, 14.6, 16.2] : [10.6, 12.2, 13.8, 15.4];
      xs.forEach((x) => this.add(peg(x, y)));
    }
    return top + (rows - 1) * 1.5;
  }

  /**
   * 마지막 "운명의 갈림길". 폭 x 8~18 통로(top 에서 벽이 x 8·18)에서 시작한다.
   * 문 아래의 회전 막대가 구슬을 왼쪽/오른쪽으로 거의 반반 갈라 보낸다.
   *  - 느린 길: 지그재그 선반마다 볼거리(방울·범퍼·바람개비·K·트램펄린)가 있다
   *  - 빠른 길: 곧장 떨어지지만 트램펄린이 있어 구슬이 쭉 튕겨 나가 시간이 들쭉날쭉해진다
   * 골인 판정은 y 좌표뿐이라 두 길 모두 바닥이 곧 골인선이다. 반환값은 goalY.
   */
  fork(top: number, o: ForkOptions) {
    const LANE_LEFT = 6;
    const LANE_RIGHT = 20;
    const g1 = this.funnel(top);
    this.add(...o.diverter(g1));
    // 두 번째 좁은 문: 앞 장애물에서 옆으로 튕긴 구슬을 다시 가운데로 모아 똑바로 떨어뜨린다
    const g = this.funnel(g1 + 7.5, 0.9);
    // 반대로 도는 막대 두 개를 겹쳐 두면 한쪽으로 쏠리는 경향이 상쇄돼 왼쪽/오른쪽이 고르게 갈린다
    this.add(sweeper(CENTER, g + 1.6, 1.25, 2.4), sweeper(CENTER, g + 3.1, 1.25, -2.9));
    const apex = g + 5.2;

    const SHELF_GAP = 6;
    const slowBottom = apex + 4 + o.slowKit.length * SHELF_GAP;
    const goalY = slowBottom + 2;
    const m = (x: number) => (o.slowSide === 'left' ? x : 2 * CENTER - x);
    const dir = o.slowSide === 'left' ? 1 : -1;

    // 바깥 벽(레인이 넓어진다), 가운데 칸막이, 지붕
    this.walls(
      [
        [LEFT, top],
        [LEFT, g],
        [LANE_LEFT, g + 3.5],
        [LANE_LEFT, goalY + 0.75],
      ],
      [
        [RIGHT, top],
        [RIGHT, g],
        [LANE_RIGHT, g + 3.5],
        [LANE_RIGHT, goalY + 0.75],
      ]
    );
    this.add(
      slope(CENTER, apex, CENTER, goalY + 0.75),
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
      if (nearDivider) this.add(slope(m(LANE_LEFT), y, m(11), y + 1.6));
      else this.add(slope(m(CENTER), y, m(LANE_LEFT + 2), y + 1.6));
      // 구슬이 틈으로 떨어지는 자리. 칸막이·벽과는 0.9 이상 띄운다
      const kx = m(nearDivider ? 11.4 : 7.6);
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
      const px = j % 2 === 0 ? 17 : 16;
      const tiltF = (j % 2 === 0 ? 0.3 : -0.3) * dir;
      this.add(trampoline(fastX(px), py, 1.4, tiltF));
      if (j % 2 === 0) this.add(bubble(fastX(14.6), py - 1.8, 0.45), bubble(fastX(18.6), py - 2.6, 0.45));
    }
    // 바닥 직전의 큰 발사대: 마지막에 한 번 더 크게 튕겨 순서가 뒤집힌다
    this.add(trampoline(fastX(16.4), goalY - 3.2, 2.1, 0.22 * dir, 1.3));
    return goalY;
  }
}

export function stageOf(title: string, goalY: number, entities: MapEntity[], adBoards: AdBoard[]): StageDef {
  return { title, goalY, zoomY: goalY - 4.25, adBoards, entities };
}

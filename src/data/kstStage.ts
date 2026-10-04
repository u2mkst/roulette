import type { MapEntity } from '../types/MapEntity.type';
import type { StageDef } from './maps';

/**
 * KST 전용 맵.
 * 위에서부터 핀볼 구간 → 회전하는 K 마크 → 지그재그 경사판 → 회전 K → 골인 깔때기.
 * 좌우 대칭의 중심은 x=13, 구슬이 태어나는 폭(x 10.25~15.65)은 맨 위 통로 안에 들어간다.
 */
const CENTER_X = 13;
const LEFT = 3;
const RIGHT = 23;
const GOAL_Y = 111;

const physics = { density: 1, angularVelocity: 0, restitution: 0 };

function wall(points: [number, number][]): MapEntity {
  return { type: 'static', position: { x: 0, y: 0 }, props: physics, shape: { type: 'polyline', rotation: 0, points } };
}

function peg(x: number, y: number, radius = 0.3): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { ...physics, restitution: 0.6 },
    shape: { type: 'circle', radius },
  };
}

/** 터지는 방울. 한 번 닿으면 사라지면서 구슬을 크게 튕겨 낸다 */
function bubble(x: number, y: number, radius = 0.5): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { ...physics, restitution: 1.5, life: 1 },
    shape: { type: 'circle', radius },
  };
}

/** 안 터지는 범퍼. 계속 튕겨서 앞서가던 구슬도 엉뚱한 쪽으로 보낸다 */
function bumper(x: number, y: number, radius = 0.6): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { ...physics, restitution: 1.3 },
    shape: { type: 'circle', radius },
  };
}

/** 트램펄린. 떨어진 구슬을 위로 되튕겨서 순위를 뒤집는다 */
function trampoline(x: number, y: number, halfWidth: number, rotation = 0): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { ...physics, restitution: 1.6 },
    shape: { type: 'box', width: halfWidth, height: 0.12, rotation },
  };
}

/** 회전하는 막대. 지나가는 구슬을 쓸어서 되돌리기도 한다 */
function sweeper(x: number, y: number, halfLength: number, angularVelocity: number): MapEntity {
  return {
    type: 'kinematic',
    position: { x, y },
    props: { ...physics, angularVelocity },
    shape: { type: 'box', width: halfLength, height: 0.1, rotation: 0 },
  };
}

/** 회전하는 K 마크. 줄기 하나와 위·아래 팔로 이어진 한 줄짜리 선이라 한 몸으로 돈다 */
function spinningK(x: number, y: number, size: number, angularVelocity: number): MapEntity {
  const s = size;
  return {
    type: 'kinematic',
    position: { x, y },
    props: { ...physics, angularVelocity },
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
  };
}

const entities: MapEntity[] = [
  // 바깥 벽: 위는 좁은 통로, 아래로 갈수록 넓어졌다가 골인 깔때기로 모인다
  wall([
    [9.25, -300],
    [9.25, 6],
    [LEFT, 14],
    [LEFT, 95],
    [12.4, 104],
    [12.4, GOAL_Y + 0.75],
  ]),
  wall([
    [16.5, -300],
    [16.5, 6],
    [RIGHT, 14],
    [RIGHT, 95],
    [13.6, 104],
    [13.6, GOAL_Y + 0.75],
  ]),
];

// 1구간: 핀볼판 (y 17~37)
for (let row = 0; row < 10; row++) {
  const y = 17 + row * 2.2;
  const offset = row % 2 === 0 ? 0 : 1;
  for (let x = 4.5 + offset; x <= 21.5; x += 2) {
    entities.push(peg(x, y));
  }
}

// 1구간 보너스: 범퍼 (닿으면 세게 튕긴다) + 첫 방울 띠
[
  [7, 25],
  [19, 25],
  [13, 29.4],
  [7, 33.8],
  [19, 33.8],
].forEach(([x, y]) => entities.push(bumper(x, y)));
for (let row = 0; row < 2; row++) {
  for (let x = 4.2 + row * 0.9; x <= 22; x += 1.8) entities.push(bubble(x, 41 + row * 1.5));
}

// 2구간: 회전하는 K 두 줄 (y 47, 58)
[7, 13, 19].forEach((x, i) => entities.push(spinningK(x, 47, 1.7, i % 2 === 0 ? 1.6 : -1.6)));
[10, 16].forEach((x, i) => entities.push(spinningK(x, 58, 1.7, i % 2 === 0 ? -1.8 : 1.8)));

// 2구간 아래: 방울 띠 (y 62~65)
for (let row = 0; row < 2; row++) {
  for (let x = 4.2 + row * 0.9; x <= 22; x += 1.8) entities.push(bubble(x, 62 + row * 1.6));
}

// 3구간: 지그재그 경사판 (y 70~88). 한쪽 벽에서 시작해 반대쪽에 빈틈을 남긴다
entities.push(
  wall([
    [LEFT, 70],
    [18, 74],
  ]),
  wall([
    [RIGHT, 80],
    [8, 84],
  ]),
  wall([
    [LEFT, 90],
    [18, 94],
  ])
);

// 경사판 틈 아래 트램펄린: 틈으로 떨어진 구슬이 위로 튀어 오르며 뒤섞인다
entities.push(trampoline(20.5, 77.8, 1.8, -0.15), trampoline(5.5, 87.8, 1.8, 0.15));
// 경사판 사이 방울
for (let x = 9; x <= 21; x += 2) entities.push(bubble(x, 87, 0.45));

// 4구간: 마지막 회전 K (y 96.5) — 깔때기 위에서 한 번 더 섞는다
[9, 17].forEach((x, i) => entities.push(spinningK(x, 96.5, 1.4, i === 0 ? 2 : -2)));

// 마지막 관문: 깔때기 입구에서 도는 막대. 먼저 온 구슬도 막히고 뒤늦은 구슬이 끼어들 수 있다
entities.push(sweeper(CENTER_X, 101.5, 1.4, 1.8));

export const kstStage: StageDef = {
  title: 'KST Stage',
  goalY: GOAL_Y,
  zoomY: 106.75,
  adBoards: [{ x: CENTER_X, y: 52.5, w: 6, h: 1.5 }],
  entities,
};

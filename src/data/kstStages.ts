import type { MapEntity } from '../types/MapEntity.type';
import type { AdBoard, StageDef } from './maps';

/**
 * KST 전용 맵 4종.
 *
 * 설계 원칙: 구슬이 벽을 타고 장애물을 피해 내려가지 못하게 "깔때기 → 좁은 문 → 문 바로 아래 장애물"을
 * 한 칸(챔버)으로 쌓는다. 깔때기가 벽에 붙은 구슬까지 전부 가운데 문으로 모으고, 문 바로 아래에 장애물이
 * 있으므로 모든 구슬이 장애물을 거쳐야 한다. 구슬은 x 10.25~15.65 에서 태어나므로 통로는 x 8~18, 중심 13.
 */
const LEFT = 8;
const RIGHT = 18;
const CENTER = 13;
const FUNNEL_HEIGHT = 4.5;
const LIP = 0.6;

const solid = { density: 1, angularVelocity: 0, restitution: 0 };

const poly = (points: [number, number][]): MapEntity => ({
  type: 'static',
  position: { x: 0, y: 0 },
  props: solid,
  shape: { type: 'polyline', rotation: 0, points },
});

const peg = (x: number, y: number, radius = 0.3): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution: 0.6 },
  shape: { type: 'circle', radius },
});

/** 터지는 방울: 한 번 닿으면 사라지면서 구슬을 크게 튕겨 낸다 */
const bubble = (x: number, y: number, radius = 0.5): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution: 1.5, life: 1 },
  shape: { type: 'circle', radius },
});

/** 범퍼: 안 터지고 계속 튕긴다 */
const bumper = (x: number, y: number, radius = 0.6): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution: 1.3 },
  shape: { type: 'circle', radius },
});

/** 트램펄린: 기울어진 탄성판. 기울기 방향으로 구슬이 튀어 나간다 */
const trampoline = (x: number, y: number, halfWidth: number, rotation: number): MapEntity => ({
  type: 'static',
  position: { x, y },
  props: { ...solid, restitution: 1.25 },
  shape: { type: 'box', width: halfWidth, height: 0.12, rotation },
});

/** 경사판: 탄성 없이 구슬을 미끄러뜨려 다음 깔때기로 보낸다 */
const slope = (x1: number, y1: number, x2: number, y2: number): MapEntity => poly([[x1, y1], [x2, y2]]);

/** 회전 막대 */
const sweeper = (x: number, y: number, halfLength: number, angularVelocity: number): MapEntity => ({
  type: 'kinematic',
  position: { x, y },
  props: { ...solid, angularVelocity },
  shape: { type: 'box', width: halfLength, height: 0.1, rotation: 0 },
});

/** 회전하는 K 마크. 줄기와 위·아래 팔을 한 줄로 이어서 한 몸으로 돈다 */
const spinningK = (x: number, y: number, s: number, angularVelocity: number): MapEntity => ({
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
const windmill = (x: number, y: number, s: number, angularVelocity: number): MapEntity => ({
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

class Builder {
  entities: MapEntity[] = [];
  /** 지금 챔버의 문 바로 아래 y (깔때기 문 끝) */
  gateY = 0;

  add(...e: MapEntity[]) {
    this.entities.push(...e);
    return this;
  }

  /** 벽에서 문까지 좁아지는 깔때기. top 은 깔때기가 벽에서 시작하는 y */
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
    this.gateY = top + FUNNEL_HEIGHT + LIP;
    return this.gateY;
  }

  /**
   * 핀볼판. 핀을 벽에서 1 이상 띄워 놓아 벽과 핀 사이 홈에 구슬이 끼지 않게 하고,
   * 줄마다 엇갈려 배치해 구슬이 반드시 몇 번씩 튕기게 한다.
   */
  pegField(top: number, rows: number) {
    for (let r = 0; r < rows; r++) {
      const y = top + r * 1.5;
      const xs = r % 2 === 0 ? [9.8, 11.4, 13, 14.6, 16.2] : [10.6, 12.2, 13.8, 15.4];
      xs.forEach((x) => this.add(peg(x, y)));
    }
    return top + (rows - 1) * 1.5;
  }

  /**
   * 마지막 "운명의 갈림길". 깔때기 문 아래의 회전 장애물이 구슬을 왼쪽(지그재그로 느린 길)과
   * 오른쪽(곧장 떨어지는 빠른 길)으로 무작위로 갈라 보낸다. 앞서던 구슬이 느린 길로 가면 뒤따르던
   * 구슬이 추월하므로 마지막까지 역전이 난다. 골인 판정은 y 좌표뿐이라 두 길 모두 바닥이 곧 골인선이다.
   */
  splitFinish(top: number, diverter: (g: number) => MapEntity[], slowShelves = 6, slowSide: 'left' | 'right' = 'left') {
    const g1 = this.funnel(top);
    this.add(...diverter(g1));
    // 두 번째 좁은 문: 앞 장애물에서 옆으로 튕긴 구슬을 다시 가운데로 모아 똑바로 떨어뜨린다.
    // 그래야 아래 분배 막대에 닿는 순간의 각도만으로 왼쪽/오른쪽이 갈려 거의 반반이 된다
    const g = this.funnel(g1 + 7.5, 0.9);
    const apex = g + 5.2;
    // 반대로 도는 막대 두 개를 겹쳐 두면 한쪽으로 쏠리는 경향이 상쇄돼 왼쪽/오른쪽이 고르게 갈린다
    this.add(sweeper(CENTER, g + 1.6, 1.25, 2.4), sweeper(CENTER, g + 3.1, 1.25, -2.9));
    const slowBottom = apex + 4 + slowShelves * 5;
    const goalY = slowBottom + 3;
    // 가운데 칸막이와 지붕: 지붕 양쪽으로 구슬이 갈라져 내려간다
    this.add(
      poly([
        [CENTER, apex],
        [CENTER, goalY + 0.75],
      ]),
      poly([
        [CENTER - 2.4, apex + 2.3],
        [CENTER, apex],
        [CENTER + 2.4, apex + 2.3],
      ])
    );
    // 느린 길: 벽 쪽과 칸막이 쪽에 번갈아 틈이 있는 경사판. 앞 장애물이 구슬을 주로 보내는 쪽을 느린 길로 삼는다
    const m = (x: number) => (slowSide === 'left' ? x : 2 * CENTER - x);
    for (let i = 0; i < slowShelves; i++) {
      const y = apex + 4 + i * 5;
      if (i % 2 === 0) this.add(slope(m(LEFT), y, m(CENTER - 1.4), y + 1.8));
      else this.add(slope(m(CENTER), y, m(LEFT + 1.4), y + 1.8));
    }
    this.add(
      poly([
        [LEFT, -300],
        [LEFT, goalY + 0.75],
      ]),
      poly([
        [RIGHT, -300],
        [RIGHT, goalY + 0.75],
      ])
    );
    return goalY;
  }

  /** 맨 위부터 마지막 깔때기 시작점까지 이어지는 바깥 벽 */
  outer(bottom: number) {
    this.add(
      poly([
        [LEFT, -300],
        [LEFT, bottom],
      ]),
      poly([
        [RIGHT, -300],
        [RIGHT, bottom],
      ])
    );
  }
}

function make(title: string, goalY: number, entities: MapEntity[], adBoards: AdBoard[]): StageDef {
  return { title, goalY, zoomY: goalY - 4.25, adBoards, entities };
}

/* ───────── 1. KST 스테이지: 회전하는 K 와 막대로 휘젓는 믹서 ───────── */
function kstMixer(): StageDef {
  const b = new Builder();
  const pegEnd = b.pegField(3, 8);
  let top = pegEnd + 1.5;

  let g = b.funnel(top);
  b.add(spinningK(CENTER, g + 3, 1.6, 1.8));
  top = g + 7.5;

  g = b.funnel(top);
  b.add(sweeper(CENTER, g + 2.8, 2.3, 2.4), bumper(CENTER, g + 5.8, 0.7));
  top = g + 8;

  g = b.funnel(top);
  for (let r = 0; r < 2; r++) for (let x = 10.2 + r * 0.9; x <= 15.9; x += 1.8) b.add(bubble(x, g + 2.2 + r * 1.5));
  b.add(spinningK(CENTER, g + 6.5, 1.6, -2));
  top = g + 10.5;

  g = b.funnel(top);
  b.add(trampoline(CENTER, g + 3, 1.7, 0.3), sweeper(CENTER, g + 6.4, 2.3, -2.4));
  top = g + 9.5;

  g = b.funnel(top);
  b.add(spinningK(11.3, g + 3, 1.3, 2.2), spinningK(14.7, g + 3, 1.3, -2.2));
  top = g + 7.5;

  const goalY = b.splitFinish(top, (g) => [spinningK(CENTER, g + 2.6, 1.7, 2.2)], 6);
  return make('KST Stage', goalY, b.entities, [{ x: CENTER, y: pegEnd + 0.6, w: 6, h: 1.5 }]);
}

/* ───────── 2. KST 핀볼: 범퍼와 방울이 터지는 핀볼 ───────── */
function kstPinball(): StageDef {
  const b = new Builder();
  const pegEnd = b.pegField(3, 6);
  let top = pegEnd + 1.5;

  let g = b.funnel(top);
  b.add(bumper(CENTER, g + 2.6, 0.75), bumper(11.2, g + 4.6), bumper(14.8, g + 4.6), bumper(CENTER, g + 6.6, 0.75));
  top = g + 9.2;

  g = b.funnel(top);
  for (let r = 0; r < 3; r++) for (let x = 9.4 + (r % 2) * 0.9; x <= 16.7; x += 1.8) b.add(bubble(x, g + 2 + r * 1.5));
  top = g + 9.8;

  g = b.funnel(top);
  b.add(
    bumper(CENTER, g + 2.4, 0.9),
    bumper(10.6, g + 4.2),
    bumper(15.4, g + 4.2),
    bumper(10.2, g + 6.2),
    bumper(15.8, g + 6.2),
    bumper(CENTER, g + 6.2, 0.75)
  );
  top = g + 9;

  // 문 바로 아래에 트램펄린을 먼저 두고, 튕겨 나간 구슬은 아래 방울 띠가 받는다
  g = b.funnel(top);
  b.add(trampoline(CENTER, g + 2.6, 1.7, -0.3));
  for (let r = 0; r < 3; r++) for (let x = 9.4 + (r % 2) * 0.9; x <= 16.7; x += 1.8) b.add(bubble(x, g + 5.4 + r * 1.5));
  top = g + 10;

  g = b.funnel(top);
  b.add(sweeper(CENTER, g + 2.8, 4.2, 1.5), bumper(11.6, g + 6.6), bumper(14.4, g + 6.6));
  top = g + 8.6;

  const goalY = b.splitFinish(top, (g) => [bumper(CENTER, g + 2.8, 0.8), bumper(10.9, g + 3.6), bumper(15.1, g + 3.6)], 6, 'right');
  return make('KST Pinball', goalY, b.entities, [{ x: CENTER, y: pegEnd + 0.6, w: 6, h: 1.5 }]);
}

/* ───────── 3. KST 트램펄린: 튀어 올라 순서가 뒤집히는 바운스 파크 ───────── */
function kstBounce(): StageDef {
  const b = new Builder();
  const pegEnd = b.pegField(3, 5);
  let top = pegEnd + 1.5;

  const chamber = (tilt: number, extra?: (g: number) => void, drop = 9.5) => {
    const g = b.funnel(top);
    b.add(trampoline(CENTER, g + 3, 1.8, tilt));
    // 튕겨 나간 구슬이 벽에 붙지 않고 다음 깔때기로 가도록 받는 경사판
    b.add(slope(LEFT, g + 5.2, CENTER - 2.2, g + 6.6), slope(RIGHT, g + 5.2, CENTER + 2.2, g + 6.6));
    extra?.(g);
    top = g + drop;
  };

  chamber(0.32);
  chamber(-0.32, (g) => b.add(bubble(10.6, g + 1.6), bubble(15.4, g + 1.6)));
  chamber(0.32, (g) => b.add(sweeper(CENTER, g + 4.4, 1.3, 2.6)), 9.8);
  chamber(-0.32);
  chamber(0.32, (g) => b.add(bubble(11, g + 1.6), bubble(CENTER, g + 1.6), bubble(15, g + 1.6)));

  const goalY = b.splitFinish(top, (g) => [trampoline(CENTER, g + 2.2, 1.5, 0.32), trampoline(CENTER, g + 4.6, 1.4, -0.32), bubble(CENTER, g + 6.2)], 6, 'right');
  return make('KST Bounce', goalY, b.entities, [{ x: CENTER, y: pegEnd + 0.6, w: 6, h: 1.5 }]);
}

/* ───────── 4. KST 서킷: 바람개비와 회전 관문으로 마지막까지 모르는 레이스 ───────── */
function kstCircuit(): StageDef {
  const b = new Builder();
  const pegEnd = b.pegField(3, 6);
  let top = pegEnd + 1.5;

  let g = b.funnel(top);
  b.add(windmill(CENTER, g + 3.2, 2.2, 1.4));
  top = g + 8;

  g = b.funnel(top);
  b.add(windmill(11, g + 3.2, 1.7, 1.8), windmill(15, g + 3.2, 1.7, -1.8), bumper(CENTER, g + 6.2, 0.7));
  top = g + 8.8;

  g = b.funnel(top);
  b.add(spinningK(CENTER, g + 3.2, 1.7, -1.8), bubble(10.8, g + 6.2), bubble(15.2, g + 6.2), bubble(CENTER, g + 6.8));
  top = g + 8.8;

  g = b.funnel(top);
  b.add(windmill(CENTER, g + 3.4, 2.4, -1.6), trampoline(11, g + 6.9, 1.3, 0.35), trampoline(15, g + 6.9, 1.3, -0.35));
  top = g + 9.4;

  // 마지막 관문: 골인 직전 문 위에서 도는 막대가 선두를 막고 후발을 끼워 준다
  g = b.funnel(top);
  b.add(sweeper(CENTER, g + 2.6, 1.9, 2.4), spinningK(CENTER, g + 5.8, 1.4, 2.2));
  top = g + 8;

  const goalY = b.splitFinish(top, (g) => [windmill(CENTER, g + 3, 2.2, 2)], 6, 'left');
  return make('KST Circuit', goalY, b.entities, [{ x: CENTER, y: pegEnd + 0.6, w: 6, h: 1.5 }]);
}

export const kstStages: StageDef[] = [kstMixer(), kstPinball(), kstBounce(), kstCircuit()];

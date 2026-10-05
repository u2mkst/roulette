import type { StageDef } from './maps';
import {
  Builder,
  bubble,
  bumper,
  CENTER,
  plank,
  slope,
  spinningK,
  stageOf,
  sweeper,
  trampoline,
  windmill,
} from './kstParts';

/**
 * KST 전용 맵 4종. 구조 자체가 서로 다르다.
 *  1. 스테이지 — 모래시계 사슬: 깔때기 → 좁은 문 → 문 아래 회전 K/막대가 계속 이어지는 믹서
 *  2. 핀볼     — 넓게 열린 핀볼판: 범퍼 격자와 방울 밭, 구슬을 안으로 되돌리는 레일, 바람개비 밭
 *  3. 바운스   — 트램펄린 계단: 길고 탄성 있는 판을 좌우로 번갈아 내려가며 튀는 맵
 *  4. 휠       — 룰렛 휠 그릇: 둥근 그릇 안에서 회전하는 K 휠이 구슬을 휘젓고, 바닥 구멍으로만 빠져나간다
 * 마지막은 모두 "운명의 갈림길"로 끝난다.
 */

/* ───────── 1. KST 스테이지: 모래시계 사슬 믹서 ───────── */
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

  b.chute(top);
  const goalY = b.fork(top, {
    diverter: (gate) => [spinningK(CENTER, gate + 2.6, 1.7, 2.2)],
    slowSide: 'left',
    slowKit: ['windmill', 'bubbles', 'bumper', 'K', 'trampoline'],
    fastPads: 3,
  });
  return stageOf('KST Stage', goalY, b.entities, [{ x: CENTER, y: pegEnd + 0.6, w: 6, h: 1.5 }]);
}

/* ───────── 2. KST 핀볼: 넓게 열린 핀볼판 ───────── */
function kstPinball(): StageDef {
  const b = new Builder();
  const L = 3;
  const R = 23;
  const FORK_TOP = 78;
  // 위는 좁은 통로, 아래로 열려 넓은 판이 되었다가 다시 모인다
  b.walls(
    [
      [8, -300],
      [8, 6],
      [L, 13],
      [L, 68],
      [8, FORK_TOP],
    ],
    [
      [18, -300],
      [18, 6],
      [R, 13],
      [R, 68],
      [18, FORK_TOP],
    ]
  );

  // 판 A (y 15~26): 범퍼 격자 — 줄마다 엇갈려 구슬이 튕겨 다닌다
  for (let r = 0; r < 5; r++) {
    const y = 15.5 + r * 2.3;
    const xs = r % 2 === 0 ? [7, 10, 13, 16, 19] : [5.5, 8.5, 11.5, 14.5, 17.5, 20.5];
    xs.forEach((x) => b.add(bumper(x, y, 0.5)));
  }

  // 되돌림 레일 1 (y 29): 벽에 붙은 구슬을 가운데 7칸 틈으로 몰아넣는다
  b.add(slope(L, 29, 9.5, 32.5), slope(R, 29, 16.5, 32.5));

  // 판 B (y 35~44): 방울 밭 + 옆 범퍼
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 6; k++) b.add(bubble(9.4 + k * 1.4 + (r % 2) * 0.7, 35 + r * 1.6, 0.45));
  }
  b.add(bumper(6, 39, 0.6), bumper(20, 39, 0.6), bumper(CENTER, 42.6, 0.7));

  // 되돌림 레일 2 (y 48)
  b.add(slope(L, 48, 10, 51.5), slope(R, 48, 16, 51.5));

  // 판 C (y 53~64): 큰 바람개비 세 개 — 판 폭 전체를 휘젓는다
  b.add(windmill(8.8, 58, 2.2, 1.5), windmill(CENTER, 58, 2.2, -1.5), windmill(17.2, 58, 2.2, 1.5));
  b.add(bumper(5.6, 62, 0.6), bumper(20.4, 62, 0.6), bumper(CENTER, 63.4, 0.7));

  const goalY = b.fork(FORK_TOP, {
    diverter: (gate) => [bumper(CENTER, gate + 2.8, 0.8), bumper(10.9, gate + 3.6), bumper(15.1, gate + 3.6)],
    slowSide: 'right',
    slowKit: ['bumper', 'windmill', 'bubbles', 'trampoline', 'K'],
    fastPads: 3,
  });
  return stageOf('KST Pinball', goalY, b.entities, [{ x: CENTER, y: 26.6, w: 7, h: 1.75 }]);
}

/* ───────── 3. KST 바운스: 트램펄린 계단 ───────── */
function kstBounce(): StageDef {
  const b = new Builder();
  const L = 5;
  const R = 21;
  const STEPS = 7;
  const FIRST = 15;
  const GAP_Y = 9.5;
  const forkTop = FIRST + STEPS * GAP_Y + 4;
  b.walls(
    [
      [8, -300],
      [8, 5],
      [L, 9],
      [L, forkTop - 6],
      [8, forkTop],
    ],
    [
      [18, -300],
      [18, 5],
      [R, 9],
      [R, forkTop - 6],
      [18, forkTop],
    ]
  );

  for (let i = 0; i < STEPS; i++) {
    const y = FIRST + i * GAP_Y;
    const fromLeft = i % 2 === 0;
    // 긴 탄성판: 한쪽 벽에서 시작해 반대쪽에 틈(5.5)을 남긴다
    if (fromLeft) b.add(plank(L, y, 15.5, y + 3.1));
    else b.add(plank(R, y, 10.5, y + 3.1));
    // 틈 아래/주변의 볼거리를 계단마다 바꾼다
    const gapX = fromLeft ? 18.3 : 7.7;
    const inward = fromLeft ? -1 : 1;
    switch (i % 4) {
      case 0:
        b.add(bubble(gapX - 1, y + 5.2, 0.45), bubble(gapX + 0.2, y + 5.8, 0.45), bubble(gapX + 1.3, y + 5.2, 0.45));
        break;
      case 1:
        b.add(bumper(gapX + inward * 0.2, y + 5.2, 0.6));
        break;
      case 2:
        b.add(windmill(gapX, y + 5.4, 1.4, fromLeft ? 2 : -2));
        break;
      default:
        b.add(trampoline(gapX, y + 5.6, 1.1, 0.4 * inward * -1, 1.0));
        break;
    }
    // 탄성판 위 방울: 판 위를 튀어 가는 구슬을 한 번 더 튕긴다
    if (i % 2 === 1) b.add(bubble(fromLeft ? 9 : 17, y + 1, 0.45));
  }

  const goalY = b.fork(forkTop, {
    diverter: (gate) => [trampoline(CENTER, gate + 2.2, 1.5, 0.32), trampoline(CENTER, gate + 4.6, 1.4, -0.32), bubble(CENTER, gate + 6.2)],
    slowSide: 'right',
    slowKit: ['trampoline', 'bubbles', 'windmill', 'bumper', 'bubbles', 'K'],
    fastPads: 3,
  });
  return stageOf('KST Bounce', goalY, b.entities, [{ x: CENTER, y: 10.8, w: 6, h: 1.5 }]);
}

/* ───────── 4. KST 휠: 룰렛 휠 그릇 ───────── */
/** 중심 (cx, cy), 반지름 r 인 원의 아래쪽 호. 각도는 도(°)이며 90° 가 맨 아래, from → to 로 step 씩 이동한다 */
function arc(cx: number, cy: number, r: number, from: number, to: number, step = 6): [number, number][] {
  const pts: [number, number][] = [];
  const dir = to > from ? 1 : -1;
  for (let a = from; dir > 0 ? a <= to : a >= to; a += dir * step) {
    const rad = (a * Math.PI) / 180;
    pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
  }
  return pts;
}

function kstWheel(): StageDef {
  const b = new Builder();
  // 큰 그릇 1: 중심 (13, 26), 반지름 9, 바닥 구멍 폭 약 3.5
  const R1 = 9;
  const C1 = 26;
  b.walls(
    [[8, -300], [8, 6], [4, 12], [4, C1], ...arc(CENTER, C1, R1, 180, 102)],
    [...arc(CENTER, C1, R1, 78, 0), [22, C1], [22, 12], [18, 6], [18, -300]]
  );
  // 그릇 2: 중심 (13, 47), 반지름 6, 바닥 구멍 폭 약 2.5
  const R2 = 6;
  const C2 = 47;
  b.walls([...arc(CENTER, C2, R2, 180, 98)], [...arc(CENTER, C2, R2, 82, 0)]);
  // 바깥 벽: 그릇 1 에서 튕겨 나온 구슬이 그릇 2 로 모이고, 그릇 2 에서 나온 구슬은 갈림길 깔때기로 모인다
  b.walls(
    [[4, C1], [4, 35], [7, 39], [7, C2], [7, C2 + R2 + 3], [8, C2 + R2 + 5]],
    [[22, C1], [22, 35], [19, 39], [19, C2], [19, C2 + R2 + 3], [18, C2 + R2 + 5]]
  );

  // 그릇 1: 위에서 떨어지는 구슬을 때리는 큰 바람개비 + 구멍 위를 도는 K 휠
  b.add(windmill(CENTER, 21.5, 3.4, 1.3));
  b.add(spinningK(CENTER, C1 + R1 - 3.1, 2.4, 2.1));
  b.add(bumper(6.2, 19, 0.6), bumper(19.8, 19, 0.6));
  // 구멍 바로 위 덮개: 곧장 구멍으로 떨어져 휠을 건너뛰는 구슬이 없도록, 구슬이 덮개에 얹혔다가 양옆으로 흘러내려 그릇을 한 바퀴 돈다
  b.add(slope(10.6, C1 + 1, 15.4, C1 + 1.5));
  // 그릇 2: 반대로 도는 작은 K 휠
  b.add(spinningK(CENTER, C2 + R2 - 2.6, 1.9, -2.4));
  b.add(bubble(9, C2 - 1.5, 0.45), bubble(17, C2 - 1.5, 0.45));
  b.add(slope(11, C2 - 2.4, 15, C2 - 2));

  const forkTop = C2 + R2 + 5;
  const goalY = b.fork(forkTop, {
    diverter: (gate) => [windmill(CENTER, gate + 3, 2.2, 2)],
    slowSide: 'left',
    slowKit: ['windmill', 'pins', 'bubbles', 'K', 'bumper'],
    fastPads: 3,
  });
  return stageOf('KST Wheel', goalY, b.entities, [{ x: CENTER, y: 8.2, w: 6, h: 1.5 }]);
}

export const kstStages: StageDef[] = [kstMixer(), kstPinball(), kstBounce(), kstWheel()];


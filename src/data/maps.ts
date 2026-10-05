import type { MapEntity } from '../types/MapEntity.type';
import { kstStages } from './kstStages';

export type AdBoard = {
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export type StageDef = {
  title: string;
  entities?: MapEntity[];
  goalY: number;
  zoomY: number;
  adBoards?: AdBoard[];
  /** 두 줄로 갈라져 내려가는 구간의 시작 y. 벽 바람개비는 이 아래에만 있고, 벽 타기 검수도 이 아래만 본다 */
  forkY?: number;
};

export const stages: StageDef[] = kstStages;

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
};

export const stages: StageDef[] = kstStages;

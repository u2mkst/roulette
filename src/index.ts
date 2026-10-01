import './localization';
import options from './options';
import { initAdSlot } from './adSlot';
import { Roulette } from './roulette';

const roulette = new Roulette();

(window as any).roulette = roulette;
(window as any).options = options;

const waitForReady = () => {
  if (!roulette.isReady) {
    window.setTimeout(waitForReady, 100);
  }
};

waitForReady();

initAdSlot();

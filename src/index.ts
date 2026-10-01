import './localization';
import { AdService } from './adService';
import options from './options';
import { Roulette } from './roulette';

const roulette = new Roulette();
const adService = new AdService();

// 소재를 시작 버튼 누른 뒤에 받으면 프리롤이 비어 보이므로 미리 받아둔다
const preloadNextAd = () => roulette.preloadAdImages(adService.nextUrls());
adService.onUpdate = preloadNextAd;
adService.init();

(window as any).roulette = roulette;
(window as any).options = options;

const PREROLL_MS = 1500;

(window as any).ads = {
  beginRound(onStart: () => void) {
    let called = false;
    const start = () => {
      if (called) return;
      called = true;
      onStart();
    };

    let ad = null;
    try {
      ad = adService.pickForRound();
      roulette.setAd(ad);
      preloadNextAd();
    } catch (e) {
      console.error('[ads] 광고 준비 실패, 광고 없이 진행합니다', e);
      ad = null;
    }

    roulette.startRecording().then(() => {
      if (!ad) return start();
      try {
        roulette.showAdOverlay('preroll');
      } catch (e) {
        console.error('[ads] 프리롤 표시 실패, 바로 시작합니다', e);
        return start();
      }
      window.setTimeout(() => {
        roulette.hideAdOverlay();
        start();
      }, PREROLL_MS);
    });
  },
  showResult() {
    try {
      roulette.showAdOverlay('result');
    } catch (e) {
      console.error('[ads] 결과 화면 광고 표시 실패', e);
    }
  },
};

const waitForReady = () => {
  if (!roulette.isReady) {
    window.setTimeout(waitForReady, 100);
  }
};

waitForReady();

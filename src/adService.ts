import { SUPABASE_KEY, SUPABASE_URL } from './supabaseConfig';
import type { AdCreativeMap, AdSlotKey, RoundAd } from './types/Ad.type';

const REFRESH_INTERVAL = 60000;

interface AdRow {
  id: string;
  advertiser: string;
  tagline?: string | null;
  link_url?: string | null;
  preroll_url?: string | null;
  goal_url?: string | null;
  result_url?: string | null;
  qr_url?: string | null;
}

/** 관리자 페이지(admin.html)에서 등록한 광고를 Supabase에서 읽어온다 */
export class AdService {
  private _ads: RoundAd[] = [];
  private _current: RoundAd | null = null;
  private _cursor = Math.floor(Math.random() * 1000000);

  /** 목록이 새로 들어올 때마다 불린다. 소재를 미리 받아두는 데 쓴다 */
  onUpdate?: () => void;

  get current(): RoundAd | null {
    return this._current;
  }

  async init(): Promise<void> {
    await this.fetchAds();
    window.setInterval(() => {
      if (document.visibilityState === 'visible') this.fetchAds();
    }, REFRESH_INTERVAL);
  }

  async fetchAds(): Promise<void> {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ads?select=*&active=eq.true&order=created_at`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!res.ok) return;
      const rows = (await res.json()) as AdRow[];
      this._ads = rows.map(toRoundAd).filter((ad) => ad.slots.length > 0);
    } catch {
      this._ads = [];
    }
    this.onUpdate?.();
  }

  nextUrls(): string[] {
    if (this._ads.length === 0) return [];
    const ad = this._ads[this._cursor % this._ads.length];
    return [...Object.values(ad.creatives), ad.qrImage].filter((u): u is string => !!u);
  }

  pickForRound(): RoundAd | null {
    if (this._ads.length === 0) {
      this._current = null;
      return null;
    }
    this._current = this._ads[this._cursor % this._ads.length];
    this._cursor++;
    return this._current;
  }
}

function toRoundAd(row: AdRow): RoundAd {
  const creatives: AdCreativeMap<string> = {};
  if (row.preroll_url) creatives.preroll = row.preroll_url;
  if (row.goal_url) creatives.goal = row.goal_url;
  if (row.result_url) creatives.result = row.result_url;
  return {
    id: row.id,
    slots: Object.keys(creatives) as AdSlotKey[],
    creatives,
    advertiser: row.advertiser,
    tagline: row.tagline ?? undefined,
    qrImage: row.qr_url ?? undefined,
    linkUrl: row.link_url ?? undefined,
  };
}

/**
 * 광고 설정 파일 — 여기만 고치면 됩니다.
 *
 * ads 배열에 광고를 추가하세요. 여러 개면 {@link ROTATE_SECONDS}초마다 돌아가며 표시됩니다.
 * 광고를 끄려면 배열을 비우세요.
 *
 * 종류 (셋 중 하나):
 *  1) 이미지 광고 : { image: 'https://.../banner.png', link: 'https://광고주.com', alt: '설명' }
 *  2) 텍스트 광고 : { text: '우리 가게 오픈!', link: 'https://광고주.com' }
 *  3) 코드 광고   : { html: '<script ...></script>' }  (애드센스 등 복사한 코드 그대로)
 */
export type Ad = {
  image?: string;
  text?: string;
  link?: string;
  alt?: string;
  html?: string;
};

export const ROTATE_SECONDS = 10;

export const ads: Ad[] = [
  // { image: 'https://example.com/banner.png', link: 'https://example.com', alt: '광고' },
  // { text: '여기에 광고 문구를 넣으세요', link: 'https://example.com' },
];

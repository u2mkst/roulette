import { type Ad, ads, ROTATE_SECONDS } from './adConfig';

function build(ad: Ad): HTMLElement {
  const box = document.createElement('div');
  if (ad.html) {
    box.innerHTML = ad.html;
    // innerHTML로 넣은 script는 실행되지 않으므로 다시 만들어 붙인다
    box.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.text;
      old.replaceWith(s);
    });
    return box;
  }
  let content: HTMLElement;
  if (ad.image) {
    const img = document.createElement('img');
    img.src = ad.image;
    img.alt = ad.alt ?? '광고';
    content = img;
  } else {
    content = document.createElement('span');
    content.textContent = ad.text ?? '';
    content.className = 'ad-text';
  }
  if (ad.link) {
    const a = document.createElement('a');
    a.href = ad.link;
    a.target = '_blank';
    a.rel = 'noopener sponsored';
    a.appendChild(content);
    box.appendChild(a);
  } else {
    box.appendChild(content);
  }
  return box;
}

export function initAdSlot() {
  const slot = document.getElementById('adSlot');
  if (!slot || ads.length === 0) return;
  let i = 0;
  const show = () => {
    slot.replaceChildren(build(ads[i % ads.length]));
    slot.hidden = false;
    i++;
  };
  show();
  if (ads.length > 1) window.setInterval(show, ROTATE_SECONDS * 1000);
}

// 경품 카드 — 경품 이름의 키워드로 그림을 고릅니다 (실제 브랜드 로고는 쓰지 않고 직접 그린 일러스트)
// 진짜 상품 이미지를 쓰고 싶으면 콘텐츠에 "1등: 상품명 | prize/파일.png" 처럼 이미지 경로를 붙이세요.
// 이미지 파일이 아직 없으면 자동으로 일러스트가 대신 나옵니다.
window.Prize = (function () {
  const ART = {
    coffee: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="104" rx="34" ry="6" fill="#0003"/>
      <path d="M36 40h48l-6 60a6 6 0 0 1-6 5H48a6 6 0 0 1-6-5z" fill="#fff8ee"/><path d="M39 62h42l-2.6 26H41.6z" fill="#8a5a36"/>
      <rect x="31" y="31" width="58" height="11" rx="5" fill="#f3e3cf"/><rect x="38" y="24" width="44" height="9" rx="4" fill="#e7cfb2"/>
      <path d="M52 8c-5 6 5 9 0 15M62 6c-5 7 5 10 0 17M72 8c-5 6 5 9 0 15" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
      <circle cx="60" cy="75" r="7" fill="#f3e3cf"/><path d="M57 75a3 3 0 0 1 6 0" stroke="#8a5a36" stroke-width="2" fill="none"/></svg>`,
    delivery: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="106" rx="40" ry="6" fill="#0003"/>
      <path d="M18 66h12M10 78h16M20 90h10" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
      <rect x="66" y="34" width="34" height="30" rx="5" fill="#fff"/><path d="M72 46h22M72 54h14" stroke="#ff7a45" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 84h44l8-18H58l-6-18H40" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="44" cy="92" r="11" fill="#2b2240"/><circle cx="44" cy="92" r="5" fill="#fff"/><circle cx="90" cy="92" r="11" fill="#2b2240"/><circle cx="90" cy="92" r="5" fill="#fff"/>
      <circle cx="36" cy="42" r="8" fill="#ffd9a8"/><path d="M28 38a8 8 0 0 1 16 0z" fill="#fff"/></svg>`,
    voucher: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="104" rx="42" ry="6" fill="#0003"/>
      <rect x="14" y="34" width="92" height="58" rx="8" fill="#fff6dc"/><rect x="14" y="34" width="92" height="58" rx="8" fill="none" stroke="#e0b44a" stroke-width="3"/>
      <rect x="50" y="34" width="12" height="58" fill="#d64545"/><rect x="14" y="58" width="92" height="10" fill="#d64545"/>
      <path d="M56 34c-14-18-30-8-18 0zM56 34c14-18 30-8 18 0z" fill="#d64545"/><circle cx="56" cy="34" r="5" fill="#b83232"/>
      <text x="86" y="86" font-size="14" font-weight="900" fill="#b8892a" text-anchor="middle" font-family="sans-serif">₩</text></svg>`,
    money: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="106" rx="40" ry="6" fill="#0003"/>
      <rect x="22" y="58" width="76" height="40" rx="5" fill="#2f9e6a" transform="rotate(-8 60 78)"/>
      <rect x="20" y="52" width="80" height="42" rx="5" fill="#3ccf8a"/><circle cx="60" cy="73" r="13" fill="#ffffff55"/>
      <text x="60" y="79" font-size="17" font-weight="900" fill="#fff" text-anchor="middle" font-family="sans-serif">₩</text>
      <path d="M30 22l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM92 14l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="#ffd34d"/>
      <path d="M58 20v14M51 27h14" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
    gift: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="106" rx="38" ry="6" fill="#0003"/>
      <rect x="24" y="50" width="72" height="52" rx="6" fill="#ff5a8a"/><rect x="18" y="38" width="84" height="18" rx="5" fill="#ff7aa2"/>
      <rect x="54" y="38" width="12" height="64" fill="#ffd34d"/><path d="M60 38c-12-22-34-12-20 0zM60 38c12-22 34-12 20 0z" fill="#ffd34d"/></svg>`
  };
  const GRAD = { coffee: ['#6b4226', '#c8925e'], delivery: ['#ff6b3d', '#ffb347'], voucher: ['#6a3fd0', '#c48bff'], money: ['#0f8a5f', '#4fd69c'], gift: ['#d63384', '#ff8fb8'] };
  function kindOf(name) {
    const n = String(name || '');
    if (/스타벅스|커피|카페|기프티콘|투썸|이디야|메가|빽다방/i.test(n)) return 'coffee';
    if (/배달|배민|쿠팡\s*이츠|쿠팡\s*잇츠|요기요|치킨|피자/i.test(n)) return 'delivery';
    if (/상품권|백화점|신세계|롯데|현대|문화/i.test(n)) return 'voucher';
    if (/지원|회식|현금|상금|원\s*$/i.test(n) && !/기프티콘/.test(n)) return /상품권|쿠폰/.test(n) ? 'voucher' : 'money';
    return 'gift';
  }
  const amountOf = name => { const m = String(name || '').match(/(\d[\d,.]*\s*(만\s*)?원)/); return m ? m[1].replace(/\s+/g, '') : ''; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // size: 'lg' | 'md' | 'sm'
  function card(prize, size = 'md') {
    if (!prize) return '';
    const k = kindOf(prize.name); const [c1, c2] = GRAD[k]; const amt = amountOf(prize.name);
    const img = prize.img && /^(https:\/\/|[\w\-./]+\.(png|jpe?g|webp|gif|svg)$)/i.test(prize.img) && !/^\.\./.test(prize.img) ? prize.img : '';
    return `<div class="prize-card pc-${size}" style="--p1:${c1};--p2:${c2}"><div class="pc-art">${img ? `<img src="${esc(img)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none;width:100%;height:100%">${ART[k]}</span>` : ART[k]}</div>
      ${amt ? `<div class="pc-amt">${esc(amt)}</div>` : ''}<div class="pc-name">${esc(prize.name)}</div></div>`;
  }
  return { card, kindOf };
})();

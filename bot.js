// Bilgisayar oyuncusu
const { bitisTuru } = require('./bitis');

function okeyMi(t, okey) {
  return t.renk === okey.renk && t.sayi === okey.sayi;
}

// Sahte okey, okeyin yerine geçen normal bir taş gibi değerlendirilir
function gercekDeger(t, okey) {
  if (t.renk === 'sahte') return { renk: okey.renk, sayi: okey.sayi };
  return t;
}

// Bir taşın eldeki diğer taşlarla ne kadar işe yaradığı
function fayda(tas, el, okey) {
  if (okeyMi(tas, okey)) return 100;
  const t = gercekDeger(tas, okey);
  let puan = 0;
  const gorulenRenk = new Set();
  for (const d of el) {
    if (d === tas || okeyMi(d, okey)) continue;
    const o = gercekDeger(d, okey);
    if (o.renk === t.renk) {
      let fark = Math.abs(o.sayi - t.sayi);
      if (fark === 12) fark = 1; // 13 ile 1 yan yana
      if (fark === 1) puan += 3;
      else if (fark === 2) puan += 1;
      else if (fark === 0) puan += 1; // çift olabilir
    } else if (o.sayi === t.sayi && !gorulenRenk.has(o.renk)) {
      gorulenRenk.add(o.renk);
      puan += 2;
    }
  }
  return puan;
}

// 15 taşlık elde bitiren bir atış var mı?
function bitirenTas(el, okey) {
  // Okeyi atarak bitirmek iki kat puan, önce onu dene
  const sirali = [...el].sort((a, b) => (okeyMi(b, okey) ? 1 : 0) - (okeyMi(a, okey) ? 1 : 0));
  for (const t of sirali) {
    const kalan = el.filter((x) => x !== t);
    if (bitisTuru(kalan, okey)) return t;
  }
  return null;
}

// Yandan mı alayım?
function yandanAlsinMi(el, tas, okey, zorluk) {
  if (!tas) return false;
  if (okeyMi(tas, okey)) return true;
  if (zorluk === 'kolay') return Math.random() < 0.15;
  // Bu taşla bitiyor muyum?
  const deneme = [...el, tas];
  if (bitirenTas(deneme, okey)) return true;
  const f = fayda(tas, deneme, okey);
  return zorluk === 'zor' ? f >= 3 : f >= 4;
}

// Hangi taşı atayım?
function atilacakTas(el, okey, zorluk) {
  const adaylar = el.filter((t) => !okeyMi(t, okey));
  if (adaylar.length === 0) return el[0];
  const puanli = adaylar.map((t) => ({ t, f: fayda(t, el, okey) + Math.random() * (zorluk === 'kolay' ? 4 : 0.5) }));
  puanli.sort((a, b) => a.f - b.f);
  return puanli[0].t;
}

module.exports = { fayda, bitirenTas, yandanAlsinMi, atilacakTas, okeyMi };

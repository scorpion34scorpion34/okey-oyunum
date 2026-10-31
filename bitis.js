// Okey el bitirme kontrolü
// el: 14 taş [{renk, sayi}], okey: {renk, sayi}
// Okey taşı joker sayılır, sahte okey (★) okeyin yerine geçer.

const RENKLER = ['kirmizi', 'sari', 'mavi', 'siyah'];

function hazirla(el, okey) {
  let joker = 0;
  const taslar = [];
  for (const t of el) {
    if (t.renk === okey.renk && t.sayi === okey.sayi) joker++;
    else if (t.renk === 'sahte') taslar.push({ renk: okey.renk, sayi: okey.sayi });
    else taslar.push({ renk: t.renk, sayi: t.sayi });
  }
  // sayac[renk][sayi] = adet
  const sayac = {};
  RENKLER.forEach((r) => (sayac[r] = new Array(15).fill(0)));
  taslar.forEach((t) => sayac[t.renk][t.sayi]++);
  return { sayac, joker, adet: taslar.length };
}

// En küçük taşı bul (renk sırası, sonra sayı)
function ilkTas(sayac) {
  for (const r of RENKLER) {
    for (let s = 1; s <= 13; s++) if (sayac[r][s] > 0) return { renk: r, sayi: s };
  }
  return null;
}

function seriVePerler(sayac, joker, kalan) {
  if (kalan === 0) return true; // artan jokerler herhangi bir gruba eklenebilir
  const t = ilkTas(sayac);
  sayac[t.renk][t.sayi]--;

  // 1) Aynı sayı, farklı renk (3 ya da 4 taş)
  const digerRenkler = RENKLER.filter((r) => r !== t.renk);
  const altKumeler = [];
  for (let m = 1; m < 8; m++) {
    const k = digerRenkler.filter((_, i) => m & (1 << i));
    if (k.length >= 2) altKumeler.push(k);
  }
  for (const k of altKumeler) {
    let lazimJoker = 0;
    const kullanilan = [];
    for (const r of k) {
      if (sayac[r][t.sayi] > 0) { sayac[r][t.sayi]--; kullanilan.push(r); }
      else lazimJoker++;
    }
    if (lazimJoker <= joker && seriVePerler(sayac, joker - lazimJoker, kalan - 1 - kullanilan.length)) {
      kullanilan.forEach((r) => sayac[r][t.sayi]++);
      sayac[t.renk][t.sayi]++;
      return true;
    }
    kullanilan.forEach((r) => sayac[r][t.sayi]++);
  }
  // Jokerlerle aynı sayı grubu (ör: 5 + okey + okey)
  if (joker >= 2 && seriVePerler(sayac, joker - 2, kalan - 1)) {
    sayac[t.renk][t.sayi]++;
    return true;
  }

  // 2) Aynı renk sıralı seri (en az 3). Taş, serinin en küçük gerçek taşıdır;
  //    altındaki yerler sadece jokerle doldurulabilir.
  for (let bas = Math.max(1, t.sayi - joker); bas <= t.sayi; bas++) {
    const altJoker = t.sayi - bas;
    if (yukariUzat(sayac, t.renk, t.sayi + 1, joker - altJoker, [], altJoker + 1, kalan - 1)) {
      sayac[t.renk][t.sayi]++;
      return true;
    }
  }

  // 3) 1 taşı 13'ün üstünde: ...12-13-1 serisi
  if (t.sayi === 1) {
    for (let uz = 3; uz <= 13; uz++) {
      if (asagiDoldur(sayac, t.renk, 13, 14 - uz + 1, joker, [], kalan - 1)) {
        sayac[t.renk][t.sayi]++;
        return true;
      }
    }
  }

  sayac[t.renk][t.sayi]++;
  return false;
}

// Seriyi yukarı doğru uzat (gerçek taş ya da joker ile), 13'ün üstüne 1 gelebilir
function yukariUzat(sayac, renk, sonraki, jKalan, alinan, uzunluk, kalan) {
  if (uzunluk >= 3 && seriVePerler(sayac, jKalan, kalan - alinan.length)) return true;
  if (sonraki > 14) return false;
  const gercek = sonraki === 14 ? 1 : sonraki;
  if (sayac[renk][gercek] > 0) {
    sayac[renk][gercek]--;
    alinan.push(gercek);
    const ok = yukariUzat(sayac, renk, sonraki + 1, jKalan, alinan, uzunluk + 1, kalan);
    alinan.pop();
    sayac[renk][gercek]++;
    if (ok) return true;
  }
  if (jKalan > 0 && yukariUzat(sayac, renk, sonraki + 1, jKalan - 1, alinan, uzunluk + 1, kalan)) return true;
  return false;
}

// 13'ten aşağı doğru en alt konuma kadar doldur (12-13-1 tipi seriler için)
function asagiDoldur(sayac, renk, konum, enAlt, jKalan, alinan, kalan) {
  if (konum < enAlt) return seriVePerler(sayac, jKalan, kalan - alinan.length);
  if (sayac[renk][konum] > 0) {
    sayac[renk][konum]--;
    alinan.push(konum);
    const ok = asagiDoldur(sayac, renk, konum - 1, enAlt, jKalan, alinan, kalan);
    alinan.pop();
    sayac[renk][konum]++;
    if (ok) return true;
  }
  if (jKalan > 0 && asagiDoldur(sayac, renk, konum - 1, enAlt, jKalan - 1, alinan, kalan)) return true;
  return false;
}

function serilerleBitiyor(el, okey) {
  const { sayac, joker, adet } = hazirla(el, okey);
  return seriVePerler(sayac, joker, adet);
}

function ciftBitiyor(el, okey) {
  const { sayac, joker } = hazirla(el, okey);
  let tek = 0;
  let cift = 0;
  for (const r of RENKLER) {
    for (let s = 1; s <= 13; s++) {
      const n = sayac[r][s];
      cift += Math.floor(n / 2);
      tek += n % 2;
    }
  }
  if (tek > joker) return false;
  cift += tek;
  cift += Math.floor((joker - tek) / 2);
  return cift >= 7;
}

// Sonuç: null (bitmiyor) ya da 'seri' / 'cift'
function bitisTuru(el, okey) {
  if (el.length !== 14) return null;
  if (serilerleBitiyor(el, okey)) return 'seri';
  if (ciftBitiyor(el, okey)) return 'cift';
  return null;
}

module.exports = { bitisTuru };

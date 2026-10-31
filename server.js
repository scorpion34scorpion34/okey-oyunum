// Neşeli Sohbet Oyunlar - Okey sunucusu
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { bitisTuru } = require('./bitis');
const Bot = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/bitis.js', (req, res) => res.sendFile(path.join(__dirname, 'bitis.js')));

// ------------------------------------------------------------
// Yardımcılar
// ------------------------------------------------------------
const BOT_ISIMLERI = ['Ayşe', 'Mehmet', 'Zeynep', 'Kaan', 'Elif', 'Orhan', 'Deniz', 'Pınar', 'Emre', 'Selin', 'Burak', 'Ece'];
const BOT_SIMGELERI = ['🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🦉', '🐙', '🌵', '🎩'];
const BICIMLER = {
  tek: { ad: 'Tek el' },
  el: { ad: 'El sayısı' },
  hedef: { ad: 'Hedef puan' },
  dusme: { ad: 'Sayıdan düşme' },
};

function rastgele(dizi) {
  return dizi[Math.floor(Math.random() * dizi.length)];
}

function karistir(dizi) {
  for (let i = dizi.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
  }
  return dizi;
}

function taslariOlustur() {
  const renkler = ['kirmizi', 'sari', 'mavi', 'siyah'];
  const taslar = [];
  let no = 0;
  for (let k = 0; k < 2; k++) {
    for (const renk of renkler) {
      for (let sayi = 1; sayi <= 13; sayi++) taslar.push({ id: no++, renk, sayi });
    }
  }
  taslar.push({ id: no++, renk: 'sahte', sayi: 0 });
  taslar.push({ id: no++, renk: 'sahte', sayi: 0 });
  return taslar;
}

function temizMetin(m, uzunluk) {
  return String(m || '').replace(/[<>]/g, '').trim().slice(0, uzunluk);
}

function yeniKod() {
  const harfler = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let kod;
  do {
    kod = '';
    for (let i = 0; i < 4; i++) kod += harfler[Math.floor(Math.random() * harfler.length)];
  } while (odalar.has(kod));
  return kod;
}

// ------------------------------------------------------------
// Durum
// ------------------------------------------------------------
const odalar = new Map(); // kod -> oda
const kisiler = new Map(); // token -> { token, isim, simge, socketId, kod }
const lobiSohbet = [];

function kisiBySocket(socket) {
  return socket.data.token ? kisiler.get(socket.data.token) : null;
}

function koltukNo(oda, token) {
  return oda.koltuklar.findIndex((k) => k && k.tip === 'insan' && k.token === token);
}

function botOlustur(oda) {
  const kullanilan = new Set(oda.koltuklar.filter(Boolean).map((k) => k.isim));
  const isim = rastgele(BOT_ISIMLERI.filter((i) => !kullanilan.has(i))) || 'Bilgisayar';
  return { tip: 'bot', isim, simge: rastgele(BOT_SIMGELERI), bagli: true };
}

// ------------------------------------------------------------
// Oda görünümü (her oyuncu yalnız kendi elini görür)
// ------------------------------------------------------------
function odaOzeti(oda) {
  return {
    kod: oda.kod,
    ad: oda.ad,
    bicim: BICIMLER[oda.ayar.bicim].ad,
    deger: oda.ayar.deger,
    dolu: oda.koltuklar.filter((k) => k && k.tip === 'insan').length,
    durum: oda.durum,
  };
}

function gorunum(oda, ben) {
  const o = oda.oyun;
  return {
    kod: oda.kod,
    ad: oda.ad,
    ayar: oda.ayar,
    bicimAd: BICIMLER[oda.ayar.bicim].ad,
    durum: oda.durum,
    sahipMi: oda.sahip === (oda.koltuklar[ben] && oda.koltuklar[ben].token),
    benim: ben,
    elNo: oda.elNo,
    puanlar: oda.puanlar,
    koltuklar: oda.koltuklar.map((k, i) =>
      k
        ? {
            isim: k.isim,
            simge: k.simge,
            bot: k.tip === 'bot',
            bagli: k.bagli,
            tasSayisi: o ? o.eller[i].length : 0,
          }
        : null
    ),
    oyun: o
      ? {
          sira: o.sira,
          cekti: o.cekti,
          elim: o.eller[ben] || [],
          sonAtilanlar: o.atilanlar.map((y) => y[y.length - 1] || null),
          atilanSayilari: o.atilanlar.map((y) => y.length),
          gosterge: o.gosterge,
          okey: o.okey,
          kalan: o.deste.length,
          baslayan: o.baslayan,
        }
      : null,
    sonuc: oda.sonuc,
    macSonu: oda.macSonu,
    sonOlay: oda.sonOlay,
  };
}

function odayiGonder(oda) {
  oda.koltuklar.forEach((k, i) => {
    if (k && k.tip === 'insan' && k.socketId) io.to(k.socketId).emit('oda', gorunum(oda, i));
  });
  lobiyiGuncelle();
  botSirasiniKontrolEt(oda);
}

function lobiyiGuncelle() {
  const liste = [...odalar.values()]
    .filter((o) => !o.ozel && o.durum === 'bekliyor' && o.koltuklar.some((k) => !k || k.tip === 'bot'))
    .map(odaOzeti);
  io.to('lobi').emit('odalar', liste);
}

function olay(oda, tur, koltuk, ek) {
  oda.olayNo = (oda.olayNo || 0) + 1;
  oda.sonOlay = Object.assign({ no: oda.olayNo, tur, koltuk }, ek || {});
}

function sistemMesaji(oda, metin) {
  const m = { sistem: true, metin, zaman: Date.now() };
  oda.sohbet.push(m);
  if (oda.sohbet.length > 60) oda.sohbet.shift();
  io.to('oda:' + oda.kod).emit('sohbet', m);
}

// ------------------------------------------------------------
// Oda kurma / katılma
// ------------------------------------------------------------
function ayarDuzelt(a) {
  a = a || {};
  const bicim = BICIMLER[a.bicim] ? a.bicim : 'tek';
  const varsayilan = { tek: 1, el: 5, hedef: 50, dusme: 20 }[bicim];
  let deger = parseInt(a.deger, 10);
  if (!deger || deger < 1 || deger > 200) deger = varsayilan;
  const zorluk = ['kolay', 'orta', 'zor'].includes(a.zorluk) ? a.zorluk : 'orta';
  const hiz = ['hizli', 'normal', 'yavas'].includes(a.hiz) ? a.hiz : 'normal';
  return { bicim, deger, zorluk, hiz };
}

function odaKur(kisi, ayar, ozel) {
  const oda = {
    kod: yeniKod(),
    ad: kisi.isim + ' masası',
    sahip: kisi.token,
    ayar: ayarDuzelt(ayar),
    ozel: !!ozel,
    koltuklar: [null, null, null, null],
    durum: 'bekliyor',
    puanlar: [0, 0, 0, 0],
    elNo: 0,
    oyun: null,
    sonuc: null,
    macSonu: null,
    sohbet: [],
    olusma: Date.now(),
  };
  odalar.set(oda.kod, oda);
  return oda;
}

function odayaOtur(kisi, oda, socket) {
  if (kisi.kod && kisi.kod !== oda.kod) odadanAyril(kisi, socket);
  let yer = koltukNo(oda, kisi.token);
  if (yer === -1) {
    if (oda.durum !== 'bekliyor') {
      // Oyun sürerken bir botun yerine geçebilir
      yer = oda.koltuklar.findIndex((k) => k && k.tip === 'bot' && k.yerine);
      if (yer === -1) return 'Bu masada oyun sürüyor.';
    } else {
      yer = oda.koltuklar.findIndex((k) => !k || k.tip === 'bot');
      if (yer === -1) return 'Masa dolu.';
    }
    oda.koltuklar[yer] = { tip: 'insan', token: kisi.token, isim: kisi.isim, simge: kisi.simge, bagli: true, socketId: socket.id };
    sistemMesaji(oda, kisi.isim + ' masaya oturdu.');
  } else {
    const k = oda.koltuklar[yer];
    k.socketId = socket.id;
    k.bagli = true;
    k.isim = kisi.isim;
    k.simge = kisi.simge;
  }
  kisi.kod = oda.kod;
  socket.leave('lobi');
  socket.join('oda:' + oda.kod);
  socket.emit('sohbetGecmisi', oda.sohbet);
  return null;
}

function odadanAyril(kisi, socket) {
  const oda = odalar.get(kisi.kod);
  kisi.kod = null;
  if (socket) {
    socket.join('lobi');
    if (oda) socket.leave('oda:' + oda.kod);
  }
  if (!oda) return;
  const yer = koltukNo(oda, kisi.token);
  if (yer !== -1) {
    if (oda.durum === 'bekliyor') {
      oda.koltuklar[yer] = null;
    } else {
      // Oyun sürüyorsa bilgisayar devralır
      const bot = botOlustur(oda);
      bot.isim = kisi.isim + ' (bilg.)';
      bot.simge = '🤖';
      bot.yerine = true;
      oda.koltuklar[yer] = bot;
    }
    sistemMesaji(oda, kisi.isim + ' masadan kalktı.');
  }
  const insanVar = oda.koltuklar.some((k) => k && k.tip === 'insan');
  if (!insanVar) {
    odalar.delete(oda.kod);
    lobiyiGuncelle();
    return;
  }
  if (oda.sahip === kisi.token) {
    const yeni = oda.koltuklar.find((k) => k && k.tip === 'insan');
    oda.sahip = yeni.token;
  }
  odayiGonder(oda);
}

// ------------------------------------------------------------
// Oyun akışı
// ------------------------------------------------------------
function macBaslat(oda) {
  for (let i = 0; i < 4; i++) if (!oda.koltuklar[i]) oda.koltuklar[i] = botOlustur(oda);
  const baslangic = oda.ayar.bicim === 'dusme' ? oda.ayar.deger : 0;
  oda.puanlar = [baslangic, baslangic, baslangic, baslangic];
  oda.elNo = 0;
  oda.macSonu = null;
  elDagit(oda);
}

function elDagit(oda) {
  oda.elNo++;
  oda.durum = 'oyunda';
  oda.sonuc = null;
  const deste = karistir(taslariOlustur());
  const gIndex = deste.findIndex((t) => t.renk !== 'sahte');
  const gosterge = deste.splice(gIndex, 1)[0];
  const okey = { renk: gosterge.renk, sayi: gosterge.sayi === 13 ? 1 : gosterge.sayi + 1 };
  const baslayan = (oda.elNo - 1) % 4;
  const eller = [[], [], [], []];
  for (let i = 0; i < 4; i++) {
    const kim = (baslayan + i) % 4;
    eller[kim] = deste.splice(0, i === 0 ? 15 : 14);
  }
  oda.oyun = {
    deste,
    gosterge,
    okey,
    eller,
    atilanlar: [[], [], [], []],
    sira: baslayan,
    baslayan,
    cekti: true,
    ilkHamle: true,
    elKimligi: Math.random(),
  };
  olay(oda, 'dagit', baslayan);
  sistemMesaji(oda, oda.elNo + '. el dağıtıldı. ' + oda.koltuklar[baslayan].isim + ' başlıyor.');
  odayiGonder(oda);
}

function solundaki(ben) {
  return (ben + 3) % 4;
}

function tasCek(oda, ben, kaynak) {
  const o = oda.oyun;
  if (!o || oda.durum !== 'oyunda' || o.sira !== ben) return 'Sıra sende değil.';
  if (o.cekti) return 'Zaten taş çektin, şimdi bir taş at.';
  let tas;
  if (kaynak === 'yan') {
    tas = o.atilanlar[solundaki(ben)].pop();
    if (!tas) return 'Yanında alınacak taş yok.';
  } else {
    if (o.deste.length === 0) {
      elBitir(oda, null);
      return null;
    }
    tas = o.deste.pop();
  }
  o.eller[ben].push(tas);
  o.cekti = true;
  olay(oda, kaynak === 'yan' ? 'yandan' : 'cek', ben, { tasId: tas.id });
  odayiGonder(oda);
  return null;
}

function tasAt(oda, ben, tasId) {
  const o = oda.oyun;
  if (!o || oda.durum !== 'oyunda' || o.sira !== ben) return 'Sıra sende değil.';
  if (!o.cekti) return 'Önce bir taş çekmelisin.';
  const el = o.eller[ben];
  const i = el.findIndex((t) => t.id === tasId);
  if (i === -1) return 'Bu taş elinde yok.';
  const tas = el.splice(i, 1)[0];
  o.atilanlar[ben].push(tas);
  o.ilkHamle = false;
  o.sira = (ben + 1) % 4;
  o.cekti = false;
  olay(oda, 'at', ben, { tas });
  if (o.deste.length === 0) {
    // Sıradaki oyuncu yandan alamıyorsa el berabere biter
    odayiGonder(oda);
    return null;
  }
  odayiGonder(oda);
  return null;
}

function eliBitir(oda, ben, tasId, dizilim) {
  const o = oda.oyun;
  if (!o || oda.durum !== 'oyunda' || o.sira !== ben) return 'Sıra sende değil.';
  if (!o.cekti) return 'Bitirmek için önce bir taş çekmelisin.';
  const el = o.eller[ben];
  const atilan = el.find((t) => t.id === tasId);
  if (!atilan) return 'Önce atacağın taşı seç.';
  const kalan = el.filter((t) => t !== atilan);
  const tur = bitisTuru(kalan, o.okey);
  if (!tur) return 'Elin henüz bitmiyor. Taşları kontrol et.';
  // Taşı elden çıkar ve gösterge yerine koy
  o.eller[ben] = kalan;
  const okeyAtti = Bot.okeyMi(atilan, o.okey);
  const elden = o.ilkHamle && ben === o.baslayan;
  let puan = 2;
  if (tur === 'cift') puan *= 2;
  if (okeyAtti) puan *= 2;
  if (elden) puan *= 2;
  elBitir(oda, { kazanan: ben, el: elDizilimi(kalan, dizilim, o.okey), atilan, tur, okeyAtti, elden, puan });
  return null;
}

// Kazananın elini gösterim için sırala; null değerler gruplar arası boşluktur
function elDizilimi(kalan, dizilim, okey) {
  if (Array.isArray(dizilim)) {
    const kimde = new Map(kalan.map((t) => [t.id, t]));
    const sonuc = [];
    for (const id of dizilim) {
      if (id === null) { if (sonuc.length && sonuc[sonuc.length - 1] !== null) sonuc.push(null); }
      else if (kimde.has(id)) { sonuc.push(kimde.get(id)); kimde.delete(id); }
    }
    if (kimde.size === 0) {
      while (sonuc.length && sonuc[sonuc.length - 1] === null) sonuc.pop();
      return sonuc;
    }
  }
  // Bilgisayar için: renge ve sayıya göre
  const sira = { kirmizi: 0, sari: 1, mavi: 2, siyah: 3, sahte: 4 };
  return kalan.slice().sort((a, b) => (Bot.okeyMi(a, okey) - Bot.okeyMi(b, okey)) || sira[a.renk] - sira[b.renk] || a.sayi - b.sayi);
}

function elBitir(oda, s) {
  const o = oda.oyun;
  if (!s) {
    oda.sonuc = { berabere: true, aciklama: 'Ortada taş kalmadı. El berabere bitti.' };
  } else {
    const isim = oda.koltuklar[s.kazanan].isim;
    const ek = [];
    if (s.tur === 'cift') ek.push('çiftten');
    if (s.okeyAtti) ek.push('okey atarak');
    if (s.elden) ek.push('elden');
    oda.sonuc = Object.assign(s, {
      isim,
      aciklama: isim + ' eli bitirdi' + (ek.length ? ' (' + ek.join(', ') + ')' : '') + '! ' + s.puan + ' puan',
    });
    if (oda.ayar.bicim === 'dusme') oda.puanlar[s.kazanan] = Math.max(0, oda.puanlar[s.kazanan] - s.puan);
    else oda.puanlar[s.kazanan] += s.puan;
  }
  oda.durum = 'elbitti';
  olay(oda, s ? 'bitti' : 'berabere', s ? s.kazanan : null);
  sistemMesaji(oda, oda.sonuc.aciklama);

  // Maç bitti mi?
  const a = oda.ayar;
  let bitti = false;
  if (a.bicim === 'tek') bitti = true;
  if (a.bicim === 'el' && oda.elNo >= a.deger) bitti = true;
  if (a.bicim === 'hedef' && oda.puanlar.some((p) => p >= a.deger)) bitti = true;
  if (a.bicim === 'dusme' && oda.puanlar.some((p) => p <= 0)) bitti = true;
  if (bitti) {
    let enIyi;
    if (a.bicim === 'dusme') enIyi = Math.min(...oda.puanlar);
    else enIyi = Math.max(...oda.puanlar);
    const kazananlar = oda.puanlar.map((p, i) => (p === enIyi ? i : -1)).filter((i) => i >= 0);
    if (a.bicim === 'tek' && s) kazananlar.splice(0, kazananlar.length, s.kazanan);
    oda.macSonu = {
      kazananlar,
      isimler: kazananlar.map((i) => oda.koltuklar[i].isim),
      berabere: a.bicim === 'tek' && !s,
    };
    oda.durum = 'macbitti';
    sistemMesaji(oda, oda.macSonu.berabere ? 'Oyun berabere bitti.' : 'Oyunu kazanan: ' + oda.macSonu.isimler.join(', ') + ' 🏆');
  }
  odayiGonder(oda);
}

// ------------------------------------------------------------
// Bilgisayar oyuncuları
// ------------------------------------------------------------
function botSirasiniKontrolEt(oda) {
  clearTimeout(oda.botZamanlayici);
  const o = oda.oyun;
  if (!o || oda.durum !== 'oyunda') return;
  const k = oda.koltuklar[o.sira];
  if (!k) return;
  const kopuk = k.tip === 'insan' && !k.bagli;
  if (k.tip !== 'bot' && !kopuk) return;
  // Bağlantısı kopan oyuncuyu 20 saniye bekle, sonra bilgisayar oynasın
  const hizlar = { hizli: 350, normal: 800, yavas: 1500 };
  let gecikme = (hizlar[oda.ayar.hiz] || 800) * (0.8 + Math.random() * 0.4);
  if (kopuk) gecikme = 20000;
  if (process.env.TEST_HIZLI) gecikme = 2;
  oda.botZamanlayici = setTimeout(() => {
    if (!odalar.has(oda.kod) || oda.oyun !== o || oda.durum !== 'oyunda') return;
    const k2 = oda.koltuklar[o.sira];
    if (!k2 || (k2.tip === 'insan' && k2.bagli)) return;
    try {
      botOyna(oda);
    } catch (e) {
      console.error('Bilgisayar oyuncusu hatası:', e);
    }
  }, gecikme);
}

function botOyna(oda) {
  const o = oda.oyun;
  const ben = o.sira;
  const zorluk = oda.ayar.zorluk;
  let hata = null;
  if (!o.cekti) {
    const yanTas = o.atilanlar[solundaki(ben)].slice(-1)[0];
    const yandan = Bot.yandanAlsinMi(o.eller[ben], yanTas, o.okey, zorluk);
    hata = tasCek(oda, ben, yandan ? 'yan' : 'orta');
  } else {
    const bitiren = Bot.bitirenTas(o.eller[ben], o.okey);
    if (bitiren) hata = eliBitir(oda, ben, bitiren.id);
    else hata = tasAt(oda, ben, Bot.atilacakTas(o.eller[ben], o.okey, zorluk).id);
  }
  if (hata) console.error('Bilgisayar hamlesi reddedildi:', hata);
}

// ------------------------------------------------------------
// Bağlantılar
// ------------------------------------------------------------
io.on('connection', (socket) => {
  socket.join('lobi');

  socket.on('kimlik', (v) => {
    v = v || {};
    const token = temizMetin(v.token, 40) || Math.random().toString(36).slice(2) + Date.now().toString(36);
    socket.data.token = token;
    let kisi = kisiler.get(token);
    if (!kisi) {
      kisi = { token, kod: null };
      kisiler.set(token, kisi);
    }
    kisi.isim = temizMetin(v.isim, 15) || 'Oyuncu ' + Math.floor(100 + Math.random() * 900);
    kisi.simge = temizMetin(v.simge, 4) || '😀';
    kisi.socketId = socket.id;
    socket.emit('kimlikTamam', { token });

    // Önceki masasına geri dön
    const oda = kisi.kod && odalar.get(kisi.kod);
    if (oda && koltukNo(oda, token) !== -1) {
      odayaOtur(kisi, oda, socket);
      odayiGonder(oda);
    } else {
      kisi.kod = null;
      socket.emit('lobiSohbetGecmisi', lobiSohbet);
      lobiyiGuncelle();
    }
  });

  const kisiGerek = (fn) => (...args) => {
    const kisi = kisiBySocket(socket);
    if (!kisi) return socket.emit('uyari', 'Bağlantı kuruluyor, tekrar dene.');
    fn(kisi, ...args);
  };
  const odaGerek = (fn) =>
    kisiGerek((kisi, ...args) => {
      const oda = kisi.kod && odalar.get(kisi.kod);
      if (!oda) return socket.emit('uyari', 'Bir masada değilsin.');
      const ben = koltukNo(oda, kisi.token);
      if (ben === -1) return socket.emit('uyari', 'Bu masada oturmuyorsun.');
      const hata = fn(kisi, oda, ben, ...args);
      if (hata) socket.emit('uyari', hata);
    });

  socket.on('profil', kisiGerek((kisi, v) => {
    kisi.isim = temizMetin(v && v.isim, 15) || kisi.isim;
    kisi.simge = temizMetin(v && v.simge, 4) || kisi.simge;
    const oda = kisi.kod && odalar.get(kisi.kod);
    if (oda) {
      const yer = koltukNo(oda, kisi.token);
      if (yer !== -1) {
        oda.koltuklar[yer].isim = kisi.isim;
        oda.koltuklar[yer].simge = kisi.simge;
        odayiGonder(oda);
      }
    }
  }));

  socket.on('odalariIste', () => lobiyiGuncelle());

  socket.on('odaKur', kisiGerek((kisi, v) => {
    const oda = odaKur(kisi, v && v.ayar, v && v.ozel);
    odayaOtur(kisi, oda, socket);
    sistemMesaji(oda, 'Masa kodu: ' + oda.kod + '. Arkadaşlarına gönder!');
    odayiGonder(oda);
  }));

  socket.on('bilgisayaraKarsi', kisiGerek((kisi, v) => {
    const oda = odaKur(kisi, v && v.ayar, true);
    oda.ad = 'Bilgisayara karşı';
    odayaOtur(kisi, oda, socket);
    macBaslat(oda);
  }));

  socket.on('odayaKatil', kisiGerek((kisi, kod) => {
    const oda = odalar.get(temizMetin(kod, 6).toUpperCase());
    if (!oda) return socket.emit('uyari', 'Bu kodla bir masa bulunamadı.');
    const hata = odayaOtur(kisi, oda, socket);
    if (hata) return socket.emit('uyari', hata);
    odayiGonder(oda);
  }));

  socket.on('hizliOyun', kisiGerek((kisi) => {
    const acik = [...odalar.values()].find(
      (o) => !o.ozel && o.durum === 'bekliyor' && o.koltuklar.some((k) => !k || k.tip === 'bot')
    );
    const oda = acik || odaKur(kisi, { bicim: 'tek' }, false);
    odayaOtur(kisi, oda, socket);
    if (!acik) sistemMesaji(oda, 'Masa kodu: ' + oda.kod + '. Biri gelince ya da hazır olunca "Oyunu başlat"a bas.');
    odayiGonder(oda);
  }));

  socket.on('odadanAyril', kisiGerek((kisi) => {
    odadanAyril(kisi, socket);
    socket.emit('lobiSohbetGecmisi', lobiSohbet);
    socket.emit('ayrildin');
    lobiyiGuncelle();
  }));

  socket.on('baslat', odaGerek((kisi, oda) => {
    if (oda.sahip !== kisi.token) return 'Oyunu masayı kuran başlatır.';
    if (oda.durum === 'oyunda') return 'Oyun zaten sürüyor.';
    macBaslat(oda);
  }));

  socket.on('sonrakiEl', odaGerek((kisi, oda) => {
    if (oda.durum !== 'elbitti') return null;
    elDagit(oda);
  }));

  socket.on('ayarDegistir', odaGerek((kisi, oda, ben, ayar) => {
    if (oda.sahip !== kisi.token) return 'Ayarları masayı kuran değiştirir.';
    if (oda.durum === 'oyunda') return 'Oyun sürerken ayar değişmez.';
    oda.ayar = ayarDuzelt(ayar);
    odayiGonder(oda);
  }));

  socket.on('cek', odaGerek((kisi, oda, ben, kaynak) => tasCek(oda, ben, kaynak)));
  socket.on('at', odaGerek((kisi, oda, ben, tasId) => tasAt(oda, ben, tasId)));
  socket.on('bitir', odaGerek((kisi, oda, ben, v) =>
    v && typeof v === 'object' ? eliBitir(oda, ben, v.tasId, v.dizilim) : eliBitir(oda, ben, v)
  ));

  socket.on('sohbet', kisiGerek((kisi, metin) => {
    metin = temizMetin(metin, 200);
    if (!metin) return;
    const simdi = Date.now();
    if (socket.data.sonMesaj && simdi - socket.data.sonMesaj < 700) return; // flood koruması
    socket.data.sonMesaj = simdi;
    const m = { isim: kisi.isim, simge: kisi.simge, metin, zaman: simdi, token: kisi.token.slice(0, 6) };
    const oda = kisi.kod && odalar.get(kisi.kod);
    if (oda) {
      oda.sohbet.push(m);
      if (oda.sohbet.length > 60) oda.sohbet.shift();
      io.to('oda:' + oda.kod).emit('sohbet', m);
    } else {
      lobiSohbet.push(m);
      if (lobiSohbet.length > 60) lobiSohbet.shift();
      io.to('lobi').emit('lobiSohbet', m);
    }
  }));

  socket.on('disconnect', () => {
    const kisi = kisiBySocket(socket);
    if (!kisi || kisi.socketId !== socket.id) return;
    const oda = kisi.kod && odalar.get(kisi.kod);
    if (!oda) return;
    const yer = koltukNo(oda, kisi.token);
    if (yer === -1) return;
    oda.koltuklar[yer].bagli = false;
    oda.koltuklar[yer].kopma = Date.now();
    odayiGonder(oda);
  });
});

// Terk edilmiş masaları temizle
setInterval(() => {
  const simdi = Date.now();
  for (const oda of odalar.values()) {
    for (let i = 0; i < 4; i++) {
      const k = oda.koltuklar[i];
      if (k && k.tip === 'insan' && !k.bagli && simdi - k.kopma > 3 * 60 * 1000) {
        const kisi = kisiler.get(k.token);
        if (kisi) odadanAyril(kisi, null);
        else oda.koltuklar[i] = null;
      }
    }
    if (!oda.koltuklar.some((k) => k && k.tip === 'insan')) odalar.delete(oda.kod);
  }
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Sunucu çalışıyor: http://localhost:' + PORT));

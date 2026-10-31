const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { bitisTuru } = require('./bitis');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// index.html yanlışlıkla public klasörünün dışına yüklendiyse onu da bul
app.get('/', (req, res) => {
  const icerde = path.join(__dirname, 'public', 'index.html');
  res.sendFile(fs.existsSync(icerde) ? icerde : path.join(__dirname, 'index.html'));
});

// Masadaki oyuncular: { id, isim }
let oyuncular = [];

// Oynanan el (dağıtılmadıysa null)
let oyun = null;

// Puanlar isme göre tutulur: { 'Sezai': 4, ... }
let puanlar = {};

function taslariOlustur() {
  const renkler = ['kirmizi', 'sari', 'mavi', 'siyah'];
  const taslar = [];
  let no = 0;
  for (let takim = 0; takim < 2; takim++) {
    for (const renk of renkler) {
      for (let sayi = 1; sayi <= 13; sayi++) {
        taslar.push({ id: no++, renk: renk, sayi: sayi });
      }
    }
  }
  taslar.push({ id: no++, renk: 'sahte', sayi: 0 });
  taslar.push({ id: no++, renk: 'sahte', sayi: 0 });
  return taslar;
}

function karistir(dizi) {
  for (let i = dizi.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
  }
  return dizi;
}

function koltukNo(socketId) {
  return oyuncular.findIndex((o) => o.id === socketId);
}

// Herkese kendi gözünden masanın durumunu gönder
function durumuGonder(mesaj) {
  oyuncular.forEach((oyuncu, i) => {
    io.to(oyuncu.id).emit('durum', {
      benim: i,
      isimler: oyuncular.map((o) => o.isim),
      oyunVar: !!oyun,
      sira: oyun ? oyun.sira : null,
      cekti: oyun ? oyun.cekti : false,
      elim: oyun ? oyun.eller[i] : [],
      tasSayilari: oyun ? oyun.eller.map((e) => e.length) : [],
      sonAtilanlar: oyun ? oyun.atilanlar.map((y) => y[y.length - 1] || null) : [],
      gosterge: oyun ? oyun.gosterge : null,
      okey: oyun ? oyun.okey : null,
      kalan: oyun ? oyun.deste.length : 0,
      puanlar: oyuncular.map((o) => puanlar[o.isim] || 0),
      mesaj: mesaj || '',
    });
  });
  // İzleyiciler (masaya oturmamış olanlar) sadece isimleri görür
  io.emit('masa', oyuncular.map((o) => o.isim));
}

io.on('connection', (socket) => {
  socket.emit('masa', oyuncular.map((o) => o.isim));

  // Masaya otur
  socket.on('katil', (isim) => {
    if (koltukNo(socket.id) !== -1) return;
    if (oyuncular.length >= 4) return socket.emit('uyari', 'Masa dolu, 4 kişi oturuyor.');
    if (oyun) return socket.emit('uyari', 'El devam ediyor, bitince otur.');
    isim = String(isim || '').trim().slice(0, 15) || 'Oyuncu ' + (oyuncular.length + 1);
    oyuncular.push({ id: socket.id, isim: isim });
    console.log('Masaya oturdu:', isim);
    durumuGonder(isim + ' masaya oturdu.');
  });

  // Yeni el dağıt
  socket.on('dagit', () => {
    if (koltukNo(socket.id) === -1) return;
    if (oyuncular.length < 2) return socket.emit('uyari', 'Dağıtmak için en az 2 kişi lazım.');

    const deste = karistir(taslariOlustur());
    const gIndex = deste.findIndex((t) => t.renk !== 'sahte');
    const gosterge = deste.splice(gIndex, 1)[0];
    const okey = { renk: gosterge.renk, sayi: gosterge.sayi === 13 ? 1 : gosterge.sayi + 1 };

    oyun = {
      deste: deste,
      gosterge: gosterge,
      okey: okey,
      eller: oyuncular.map((o, i) => deste.splice(0, i === 0 ? 15 : 14)),
      atilanlar: oyuncular.map(() => []),
      sira: 0,       // 1. oyuncu başlar
      cekti: true,   // 15 taşı olduğu için çekmeden atar
    };

    console.log('Yeni el. Okey:', okey.renk, okey.sayi);
    durumuGonder('Yeni el dağıtıldı. ' + oyuncular[0].isim + ' başlıyor: bir taş atsın.');
  });

  // Taş çek: kaynak = 'orta' ya da 'yan'
  socket.on('cek', (kaynak) => {
    const ben = koltukNo(socket.id);
    if (!oyun || ben !== oyun.sira) return socket.emit('uyari', 'Sıra sende değil.');
    if (oyun.cekti) return socket.emit('uyari', 'Zaten taş çektin, şimdi bir taş at.');

    let tas;
    if (kaynak === 'yan') {
      const solum = (ben - 1 + oyuncular.length) % oyuncular.length;
      tas = oyun.atilanlar[solum].pop();
      if (!tas) return socket.emit('uyari', 'Yanında alınacak taş yok.');
    } else {
      if (oyun.deste.length === 0) {
        oyun = null;
        return durumuGonder('Ortada taş kalmadı. El berabere bitti, yeniden dağıtın.');
      }
      tas = oyun.deste.pop();
    }

    oyun.eller[ben].push(tas);
    oyun.cekti = true;
    durumuGonder(oyuncular[ben].isim + (kaynak === 'yan' ? ' yandan aldı.' : ' ortadan çekti.'));
  });

  // Taş at
  socket.on('at', (tasId) => {
    const ben = koltukNo(socket.id);
    if (!oyun || ben !== oyun.sira) return socket.emit('uyari', 'Sıra sende değil.');
    if (!oyun.cekti) return socket.emit('uyari', 'Önce bir taş çekmelisin.');

    const el = oyun.eller[ben];
    const i = el.findIndex((t) => t.id === tasId);
    if (i === -1) return;

    const tas = el.splice(i, 1)[0];
    oyun.atilanlar[ben].push(tas);
    oyun.sira = (ben + 1) % oyuncular.length;
    oyun.cekti = false;
    durumuGonder(oyuncular[ben].isim + ' taş attı. Sıra şimdi: ' + oyuncular[oyun.sira].isim);
  });

  // Eli bitir: bir taşı yere atarak kalan 14 taşı açar
  socket.on('bitir', (veri) => {
    const ben = koltukNo(socket.id);
    if (!oyun || ben !== oyun.sira) return socket.emit('uyari', 'Sıra sende değil.');
    if (!oyun.cekti) return socket.emit('uyari', 'Bitirmek için önce bir taş çekmelisin.');
    veri = veri || {};

    const el = oyun.eller[ben];
    const i = el.findIndex((t) => t.id === veri.tasId);
    if (i === -1) return socket.emit('uyari', 'Önce atacağın taşı seç.');

    const atilan = el[i];
    const kalan = el.filter((t) => t.id !== atilan.id);
    const tur = bitisTuru(kalan, oyun.okey);
    if (!tur) return socket.emit('uyari', 'Elin henüz bitmiyor. Taşları kontrol et.');

    // Kazananın kendi dizilişiyle göster
    if (Array.isArray(veri.dizilis)) {
      const yer = {};
      veri.dizilis.forEach((id, k) => (yer[id] = k));
      kalan.sort((a, b) => (yer[a.id] ?? 99) - (yer[b.id] ?? 99));
    }

    const okeyAtti = atilan.renk === oyun.okey.renk && atilan.sayi === oyun.okey.sayi;
    let puan = 2;
    if (tur === 'cift') puan *= 2;
    if (okeyAtti) puan *= 2;

    const isim = oyuncular[ben].isim;
    puanlar[isim] = (puanlar[isim] || 0) + puan;

    let aciklama = isim + ' eli bitirdi';
    if (tur === 'cift') aciklama += ', çiftten';
    if (okeyAtti) aciklama += ', okey atarak';
    aciklama += '! +' + puan + ' puan';

    io.emit('bitti', { isim: isim, el: kalan, atilan: atilan, okey: oyun.okey, aciklama: aciklama });
    console.log(aciklama);
    oyun = null;
    durumuGonder(aciklama + ' · Yeni el için "Yeni El Dağıt".');
  });

  socket.on('disconnect', () => {
    const ben = koltukNo(socket.id);
    if (ben === -1) return;
    const isim = oyuncular[ben].isim;
    oyuncular.splice(ben, 1);
    console.log('Masadan kalktı:', isim);
    const elVardi = !!oyun;
    oyun = null;
    durumuGonder(isim + ' masadan kalktı.' + (elVardi ? ' El iptal edildi.' : ''));
  });
});

// İnternette Render kendi port numarasını verir, bilgisayarda 3000 kullanılır
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Sunucu çalışıyor: http://localhost:' + PORT);
});

// Neşeli Sohbet Oyunlar - Okey istemcisi
(function () {
  'use strict';

  // =========================================================
  // Kayıtlı ayarlar ve istatistikler
  // =========================================================
  function oku(anahtar, varsayilan) {
    try {
      const v = JSON.parse(localStorage.getItem(anahtar));
      return v == null ? varsayilan : Object.assign({}, varsayilan, v);
    } catch (e) {
      return varsayilan;
    }
  }
  function yaz(anahtar, deger) {
    try { localStorage.setItem(anahtar, JSON.stringify(deger)); } catch (e) { /* önemli değil */ }
  }

  const SIMGELER = ['😀', '😎', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🦉', '🐙', '🌵', '🎩', '🌸', '⚽', '🎸', '☕'];
  const ayar = oku('nso_ayar', {
    isim: '', simge: '😀', tema: 'yesil', tasStili: 'fildisi', tasBoyu: 'orta',
    ses: true, sesDuzeyi: 0.7, okeyIsaret: true, kufur: true,
    sonOyun: { bicim: 'tek', deger: 1, zorluk: 'orta', hiz: 'normal' },
  });
  const ist = oku('nso_ist', {
    oynanan: 0, kazanilan: 0, seri: 0, enIyiSeri: 0, oynananEl: 0, kazanilanEl: 0, okeyBitis: 0, ciftBitis: 0, eldenBitis: 0,
  });
  let token = '';
  try { token = localStorage.getItem('nso_token') || ''; } catch (e) { /* yok */ }

  function ayarKaydet() { yaz('nso_ayar', ayar); temaUygula(); }
  function temaUygula() {
    const b = document.body.classList;
    ['tema-mavi', 'tema-bordo', 'tas-kucuk', 'tas-buyuk', 'tas-koyu', 'tas-kontrast'].forEach((c) => b.remove(c));
    if (ayar.tema !== 'yesil') b.add('tema-' + ayar.tema);
    if (ayar.tasBoyu !== 'orta') b.add('tas-' + ayar.tasBoyu);
    if (ayar.tasStili === 'koyu') b.add('tas-koyu');
    if (ayar.tasStili === 'kontrast') b.add('tas-kontrast');
    $('sesDugme').textContent = ayar.ses ? '🔊' : '🔇';
    profilGoster();
  }

  // =========================================================
  // Kısa yardımcılar
  // =========================================================
  const $ = (id) => document.getElementById(id);
  function el(etiket, sinif, metin) {
    const e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (metin != null) e.textContent = metin;
    return e;
  }
  const RENK_AD = { kirmizi: 'Kırmızı', sari: 'Sarı', mavi: 'Mavi', siyah: 'Siyah' };
  function okeyMi(t) {
    return durum && durum.oyun && t.renk === durum.oyun.okey.renk && t.sayi === durum.oyun.okey.sayi;
  }
  function tasKutu(t, ek) {
    const d = el('div', 'tas ' + t.renk + (ek ? ' ' + ek : ''), t.renk === 'sahte' ? '★' : String(t.sayi));
    if (ayar.okeyIsaret && okeyMi(t)) d.classList.add('okey-isaret');
    return d;
  }
  function bildir(metin, sure) {
    const b = el('div', 'bildirim', metin);
    document.body.appendChild(b);
    setTimeout(() => b.remove(), sure || 2600);
  }
  const KUFURLER = ['amk', 'aq', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'pezevenk', 'kahpe', 'ibne', 'amına', 'siktir', 'oç', 'mk'];
  function suzgec(m) {
    if (!ayar.kufur) return m;
    return m.replace(/[\wçğıöşüÇĞİÖŞÜ]+/g, (k) => (KUFURLER.includes(k.toLocaleLowerCase('tr')) ? '*'.repeat(k.length) : k));
  }

  // =========================================================
  // Sesler (dosyasız, tarayıcı içinde üretilir)
  // =========================================================
  let sesBaglam = null;
  function baglam() {
    if (!ayar.ses) return null;
    try {
      if (!sesBaglam) sesBaglam = new (window.AudioContext || window.webkitAudioContext)();
      if (sesBaglam.state === 'suspended') sesBaglam.resume();
      return sesBaglam;
    } catch (e) { return null; }
  }
  function tik(gecikme, frekans, sure, guc) {
    const c = baglam();
    if (!c) return;
    const t0 = c.currentTime + (gecikme || 0);
    const uzunluk = Math.floor(c.sampleRate * (sure || 0.05));
    const tampon = c.createBuffer(1, uzunluk, c.sampleRate);
    const veri = tampon.getChannelData(0);
    for (let i = 0; i < uzunluk; i++) veri[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / uzunluk, 4);
    const kaynak = c.createBufferSource();
    kaynak.buffer = tampon;
    const filtre = c.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.frequency.value = frekans || 2200;
    filtre.Q.value = 1.2;
    const g = c.createGain();
    g.gain.value = (guc || 1) * ayar.sesDuzeyi;
    kaynak.connect(filtre).connect(g).connect(c.destination);
    kaynak.start(t0);
    // Tahtaya vuruş için alçak bir tok ses
    const o = c.createOscillator();
    const og = c.createGain();
    o.frequency.setValueAtTime(180, t0);
    o.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
    og.gain.setValueAtTime(0.25 * (guc || 1) * ayar.sesDuzeyi, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    o.connect(og).connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.1);
  }
  function nota(frekans, gecikme, sure, tip, guc) {
    const c = baglam();
    if (!c) return;
    const t0 = c.currentTime + (gecikme || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tip || 'sine';
    o.frequency.value = frekans;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18 * (guc || 1) * ayar.sesDuzeyi, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (sure || 0.3));
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + (sure || 0.3) + 0.05);
  }
  const Ses = {
    tasKoy: () => tik(0, 2400, 0.045, 0.9),
    tasAt: () => { tik(0, 1800, 0.06, 1.2); },
    cek: () => { tik(0, 3200, 0.03, 0.5); tik(0.05, 2600, 0.04, 0.7); },
    dagit: () => { for (let i = 0; i < 8; i++) tik(i * 0.06, 2000 + Math.random() * 1500, 0.04, 0.6); },
    sira: () => { nota(660, 0, 0.18); nota(880, 0.12, 0.3); },
    mesaj: () => nota(1200, 0, 0.12, 'triangle', 0.6),
    kazan: () => [523, 659, 784, 1046].forEach((f, i) => nota(f, i * 0.12, 0.45, 'triangle')),
    kaybet: () => [392, 330].forEach((f, i) => nota(f, i * 0.18, 0.4, 'sine', 0.7)),
  };

  // =========================================================
  // Bağlantı
  // =========================================================
  const socket = io();
  let durum = null; // son oda görünümü
  let ekran = 'menu';
  let bekleyenKod = new URLSearchParams(location.search).get('masa');

  socket.on('connect', () => {
    $('baglantiDurum').textContent = '● Çevrimiçi';
    $('baglantiDurum').style.color = '#9effa9';
    socket.emit('kimlik', { token, isim: ayar.isim, simge: ayar.simge });
  });
  socket.on('disconnect', () => {
    $('baglantiDurum').textContent = '● Bağlantı yok';
    $('baglantiDurum').style.color = '#ffb4b4';
    if (ekran === 'masa') bildir('Bağlantı koptu, yeniden bağlanılıyor…');
  });
  socket.on('kimlikTamam', (v) => {
    token = v.token;
    try { localStorage.setItem('nso_token', token); } catch (e) { /* yok */ }
    if (bekleyenKod && ayar.isim) {
      socket.emit('odayaKatil', bekleyenKod);
      bekleyenKod = null;
      history.replaceState(null, '', location.pathname);
    }
  });
  socket.on('uyari', (m) => bildir(m));
  socket.on('odalar', masaListesi);
  socket.on('ayrildin', () => {
    durum = null;
    istaka.yuvalar = new Array(30).fill(null);
    ekranGoster(oncekiEkran === 'lobi' ? 'lobi' : 'menu');
  });

  // =========================================================
  // Ekranlar
  // =========================================================
  let oncekiEkran = 'menu';
  function ekranGoster(ad) {
    ['menu', 'lobi', 'masa'].forEach((e) => $(e).classList.toggle('gizli', e !== ad));
    if (ad !== 'masa') oncekiEkran = ad;
    ekran = ad;
    if (ad === 'lobi') socket.emit('odalariIste');
  }

  function profilGoster() {
    const p = $('menuProfil');
    p.querySelector('.simge').textContent = ayar.simge;
    p.querySelector('.isim').textContent = ayar.isim || 'Adını seç';
  }

  // =========================================================
  // Pencereler
  // =========================================================
  function pencere(baslik, govde, dugmeler) {
    const perde = el('div', 'perde');
    const p = el('div', 'pencere');
    const bas = el('div', 'pencere-bas');
    bas.appendChild(el('h2', '', baslik));
    const kapat = el('button', 'ikon-dugme', '✕');
    bas.appendChild(kapat);
    const g = el('div', 'pencere-govde');
    if (typeof govde === 'string') g.innerHTML = govde;
    else g.appendChild(govde);
    p.appendChild(bas);
    p.appendChild(g);
    function kapa() { perde.remove(); }
    if (dugmeler && dugmeler.length) {
      const alt = el('div', 'pencere-alt');
      dugmeler.forEach((d) => {
        const b = el('button', 'dugme ' + (d.sinif || ''), d.yazi);
        b.onclick = () => { if (d.tikla && d.tikla() === false) return; kapa(); };
        alt.appendChild(b);
      });
      p.appendChild(alt);
    }
    kapat.onclick = kapa;
    perde.addEventListener('pointerdown', (e) => { if (e.target === perde) kapa(); });
    perde.appendChild(p);
    $('pencereler').appendChild(perde);
    return { kapa, govde: g };
  }

  function secici(secenekler, secili, degisti) {
    const s = el('div', 'secici');
    secenekler.forEach(([deger, yazi]) => {
      const b = el('button', deger === secili ? 'secik' : '', yazi);
      b.onclick = () => {
        s.querySelectorAll('button').forEach((x) => x.classList.remove('secik'));
        b.classList.add('secik');
        degisti(deger);
      };
      s.appendChild(b);
    });
    return s;
  }
  function anahtar(acik, degisti) {
    const b = el('button', 'anahtar' + (acik ? ' acik' : ''));
    b.onclick = () => { b.classList.toggle('acik'); degisti(b.classList.contains('acik')); };
    return b;
  }
  function satir(ad, alt, kontrol) {
    const s = el('div', 'satir');
    const y = el('div');
    y.appendChild(el('div', 'ad', ad));
    if (alt) y.appendChild(el('div', 'alt', alt));
    s.appendChild(y);
    s.appendChild(kontrol);
    return s;
  }
  function baslikEkle(kap, metin) { kap.appendChild(el('div', 'bolum-baslik', metin)); }

  function profilIcerik(gecici) {
    const k = el('div');
    baslikEkle(k, 'Adın');
    const girdi = el('input', 'metin-kutu');
    girdi.maxLength = 15;
    girdi.value = gecici.isim;
    girdi.placeholder = 'Adını yaz';
    girdi.oninput = () => (gecici.isim = girdi.value);
    k.appendChild(girdi);
    baslikEkle(k, 'Simge');
    const s = el('div', 'simgeler');
    SIMGELER.forEach((sm) => {
      const b = el('button', sm === gecici.simge ? 'secik' : '', sm);
      b.onclick = () => {
        s.querySelectorAll('button').forEach((x) => x.classList.remove('secik'));
        b.classList.add('secik');
        gecici.simge = sm;
      };
      s.appendChild(b);
    });
    k.appendChild(s);
    setTimeout(() => girdi.focus(), 50);
    return k;
  }
  function profilKaydet(gecici) {
    ayar.isim = (gecici.isim || '').trim().slice(0, 15) || 'Oyuncu ' + Math.floor(100 + Math.random() * 900);
    ayar.simge = gecici.simge;
    ayarKaydet();
    socket.emit('profil', { isim: ayar.isim, simge: ayar.simge });
  }

  function hosgeldin(sonra) {
    const g = { isim: ayar.isim, simge: ayar.simge };
    pencere('Hoş geldin! 👋', (() => {
      const k = el('div');
      k.appendChild(el('p', 'aciklama', 'Diğer oyuncular seni bu adla görecek. Sonra Ayarlar\'dan değiştirebilirsin.'));
      k.appendChild(profilIcerik(g));
      return k;
    })(), [{ yazi: 'Devam', sinif: 'altin', tikla: () => { profilKaydet(g); if (sonra) sonra(); } }]);
  }
  function adGerekli(sonra) {
    if (ayar.isim) sonra();
    else hosgeldin(sonra);
  }

  function ayarlarPenceresi() {
    const g = { isim: ayar.isim, simge: ayar.simge };
    const k = el('div');
    baslikEkle(k, 'Genel');
    k.appendChild(profilIcerik(g));
    baslikEkle(k, 'Görünüm');
    k.appendChild(el('div', 'ad', 'Masa rengi'));
    const temalar = el('div', 'temalar');
    [['yesil', 'Klasik yeşil', '#2f9a4c'], ['mavi', 'Gece mavisi', '#2a5fc4'], ['bordo', 'Bordo', '#a8323f']].forEach(([d, y, r]) => {
      const b = el('button', ayar.tema === d ? 'secik' : '', y);
      b.style.background = r;
      b.onclick = () => {
        temalar.querySelectorAll('button').forEach((x) => x.classList.remove('secik'));
        b.classList.add('secik');
        ayar.tema = d;
        ayarKaydet();
      };
      temalar.appendChild(b);
    });
    k.appendChild(temalar);
    k.appendChild(satir('Taş stili', null, secici([['fildisi', 'Fildişi'], ['koyu', 'Koyu'], ['kontrast', 'Yüksek kontrast']], ayar.tasStili, (v) => { ayar.tasStili = v; ayarKaydet(); })));
    k.appendChild(satir('Taş boyutu', null, secici([['kucuk', 'Küçük'], ['orta', 'Orta'], ['buyuk', 'Büyük']], ayar.tasBoyu, (v) => { ayar.tasBoyu = v; ayarKaydet(); })));
    k.appendChild(satir('Okey taşlarını işaretle', 'Elindeki okeyin köşesinde küçük bir yıldız görünür.', anahtar(ayar.okeyIsaret, (v) => { ayar.okeyIsaret = v; ayarKaydet(); if (durum) masaCiz(); })));
    baslikEkle(k, 'Ses');
    k.appendChild(satir('Taş ve oyun sesleri', null, anahtar(ayar.ses, (v) => { ayar.ses = v; ayarKaydet(); if (v) Ses.tasKoy(); })));
    const sur = el('input');
    sur.type = 'range'; sur.min = 0.1; sur.max = 1; sur.step = 0.05; sur.value = ayar.sesDuzeyi;
    sur.oninput = () => { ayar.sesDuzeyi = parseFloat(sur.value); };
    sur.onchange = () => { ayarKaydet(); Ses.tasAt(); };
    k.appendChild(satir('Ses düzeyi', null, sur));
    baslikEkle(k, 'Sohbet');
    k.appendChild(satir('Küfür süzgeci', 'Gelen mesajlardaki kaba sözleri yıldızlar.', anahtar(ayar.kufur, (v) => { ayar.kufur = v; ayarKaydet(); })));
    pencere('Ayarlar', k, [{ yazi: 'Tamam', sinif: 'altin', tikla: () => profilKaydet(g) }]);
  }

  function kurallarPenceresi() {
    pencere('Kurallar', `<div class="kurallar">
      <h3>Amaç</h3><p>Elindeki 14 taşı geçerli gruplara dizip 15. taşı atarak eli bitirmek. El başında başlayan oyuncuya 15, diğerlerine 14 taş dağıtılır.</p>
      <h3>Gruplar</h3><ul>
        <li><b>Seri:</b> aynı renkten en az 3 ardışık sayı. Örnek: kırmızı 4-5-6.</li>
        <li><b>Per:</b> aynı sayının 3 ya da 4 farklı rengi. Örnek: sarı 9, mavi 9, siyah 9.</li>
        <li>12-13-1 geçerli bir seridir, 13-1-2 değildir.</li>
        <li><b>Çift:</b> 7 tane aynı taş çifti ile de el bitirilebilir.</li></ul>
      <h3>Gösterge ve okey</h3><p>Ortada açılan gösterge taşının aynı renkte bir üstü <b>okey</b>dir ve joker gibi her taşın yerine geçer. 13'ün üstü 1'dir. Yıldızlı <b>sahte okey</b> ise okey taşının kendisi yerine kullanılır.</p>
      <h3>Sıra</h3><p>Sırası gelen oyuncu ortadan ya da solundaki oyuncunun son attığı taşı alır, sonra bir taş atar. Sıra sağa doğru ilerler.</p>
      <h3>Puanlama</h3><ul>
        <li>Eli bitiren 2 puan alır.</li>
        <li>Okeyi atarak bitirmek: puan iki katı.</li>
        <li>Çiftten bitirmek: puan iki katı.</li>
        <li>Elden bitirmek (başlayanın hiç taş çekmeden ilk hamlede bitirmesi): puan iki katı.</li>
        <li>Ortada taş kalmazsa el berabere biter.</li></ul>
      <h3>Oyun biçimleri</h3><ul>
        <li><b>Tek el:</b> bir el oynanır, bitiren kazanır.</li>
        <li><b>El sayısı:</b> belirlenen sayıda el oynanır, en çok puanı toplayan kazanır.</li>
        <li><b>Hedef puan:</b> hedef puana ilk ulaşan kazanır.</li>
        <li><b>Sayıdan düşme:</b> herkes aynı puandan başlar, el bitiren puanını düşer, sıfıra ilk inen kazanır.</li></ul>
    </div>`, [{ yazi: 'Nasıl oynanır?', tikla: () => { setTimeout(yardimPenceresi, 0); } }, { yazi: 'Tamam', sinif: 'altin' }]);
  }

  function yardimPenceresi() {
    pencere('Nasıl oynanır?', `<div class="akordiyon">
      <p class="aciklama" style="margin-bottom:10px">Başlıklara dokunarak açabilirsin.</p>
      <details open><summary>🎮 Oyuna nasıl başlarım?</summary><ol>
        <li>Ana menüde "Bilgisayara karşı"ya bas, oyun biçimini ve zorluğu seç, "Başla" de.</li>
        <li>Arkadaşlarınla oynamak için "Online oyna"ya gir.</li></ol></details>
      <details><summary>🔄 Sıra bana gelince ne yapacağım?</summary><ol>
        <li>Önce bir taş al: ortadaki desteye ya da solundaki oyuncunun attığı taşa dokun. Alabileceğin yerler altın renkte yanıp söner.</li>
        <li>Sonra bir taş at: taşa çift dokun, ya da taşı sürükleyip sağ alttaki kesikli çerçeveye bırak, ya da taşı seçip "At"a bas.</li>
        <li>Sıra sende değilken ortadaki yazı kimin oynadığını söyler.</li></ol></details>
      <details><summary>🀄 Taşları nasıl düzenlerim?</summary><ol>
        <li>Taşı tutup istakada istediğin boş yere sürükle.</li>
        <li>"Diz" düğmesi taşlarını seriye, pere ya da çiftlere göre otomatik dizer.</li>
        <li>Yıldızlı taş sahte okeydir. Köşesinde altın yıldız olan taş okeydir.</li></ol></details>
      <details><summary>🏁 Eli nasıl bitiririm?</summary><ol>
        <li>Elin tamamlanınca "Bitir" düğmesi parlar.</li>
        <li>"Bitir"e bas ya da fazla taşı sürükleyip ortadaki gösterge taşının üstüne bırak.</li></ol></details>
      <details><summary>🌐 Online nasıl oynarım?</summary><ol>
        <li>"Hızlı oyun" seni açık bir masaya oturtur, yoksa yeni masa kurar.</li>
        <li>"Arkadaşlarla oyna" ile masa kur. Masa kodunu ya da bağlantıyı WhatsApp'tan gönder.</li>
        <li>Herkes gelince masayı kuran "Oyunu başlat"a basar. Boş koltuklara bilgisayar oturur.</li>
        <li>Sayfa yenilense ya da bağlantı kopsa bile aynı tarayıcıdan geri döndüğünde yerine oturursun.</li></ol></details>
      <details><summary>💬 Sohbet nasıl çalışır?</summary><ol>
        <li>Masada sağdaki sohbet panelinden yaz. Telefonda üstteki 💬 düğmesiyle açılır.</li>
        <li>Hazır cümleler ve emojilerle tek dokunuşta yazabilirsin. Yazılanlar oyuncunun yanında balon olarak da görünür.</li></ol></details>
      <details><summary>⚙️ Ayarlar neler?</summary><ol>
        <li>Adın, simgen, masa rengi, taş stili ve boyutu.</li>
        <li>Ses açma kapama ve ses düzeyi, küfür süzgeci.</li></ol></details>
    </div>`, [{ yazi: 'Kurallar', tikla: () => { setTimeout(kurallarPenceresi, 0); } }, { yazi: 'Tamam', sinif: 'altin' }]);
  }

  function istatistikPenceresi() {
    const k = el('div', 'istatistik');
    const basari = ist.oynanan ? Math.round((100 * ist.kazanilan) / ist.oynanan) + '%' : '–';
    [[ist.oynanan, 'Oynanan oyun'], [ist.kazanilan, 'Kazanılan'], [basari, 'Başarı'], [ist.seri, 'Galibiyet serisi'],
      [ist.enIyiSeri, 'En iyi seri'], [ist.kazanilanEl + '/' + ist.oynananEl, 'Kazanılan el'], [ist.okeyBitis, 'Okey ile bitiş'],
      [ist.ciftBitis, 'Çift ile bitiş'], [ist.eldenBitis, 'Elden bitiş']].forEach(([d, y]) => {
      const kutu = el('div');
      kutu.appendChild(el('b', '', String(d)));
      kutu.appendChild(el('span', '', y));
      k.appendChild(kutu);
    });
    pencere('İstatistikler', k, [
      { yazi: 'Sıfırla', tikla: () => { Object.keys(ist).forEach((a) => (ist[a] = 0)); yaz('nso_ist', ist); } },
      { yazi: 'Tamam', sinif: 'altin' },
    ]);
  }

  function yeniOyunPenceresi(mod) {
    const s = Object.assign({}, ayar.sonOyun);
    const k = el('div');
    const degerler = { tek: [], el: [3, 5, 11], hedef: [20, 50, 100], dusme: [10, 20, 40] };
    const aciklamalar = {
      tek: 'Tek el oynanır, eli bitiren kazanır.',
      el: 'Belirlenen sayıda el oynanır, en çok puanı toplayan kazanır.',
      hedef: 'Hedef puana ilk ulaşan kazanır.',
      dusme: 'Herkes bu puandan başlar, eli bitiren puanını düşer, sıfıra ilk inen kazanır.',
    };
    const degerBaslik = { el: 'El sayısı', hedef: 'Hedef puan', dusme: 'Başlangıç puanı' };
    const degerKutu = el('div');
    function degerCiz() {
      degerKutu.innerHTML = '';
      if (s.bicim !== 'tek') {
        if (!degerler[s.bicim].includes(s.deger)) s.deger = degerler[s.bicim][1];
        baslikEkle(degerKutu, degerBaslik[s.bicim]);
        degerKutu.appendChild(secici(degerler[s.bicim].map((d) => [d, String(d)]), s.deger, (v) => (s.deger = v)));
      } else s.deger = 1;
      degerKutu.appendChild(el('p', 'aciklama', aciklamalar[s.bicim]));
    }
    baslikEkle(k, 'Oyun biçimi');
    k.appendChild(secici([['tek', 'Tek el'], ['dusme', 'Sayıdan düşme'], ['el', 'El sayısı'], ['hedef', 'Hedef puan']], s.bicim, (v) => { s.bicim = v; degerCiz(); }));
    k.appendChild(degerKutu);
    degerCiz();
    baslikEkle(k, 'Bilgisayar zorluğu');
    k.appendChild(secici([['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']], s.zorluk, (v) => (s.zorluk = v)));
    baslikEkle(k, 'Bilgisayar hızı');
    k.appendChild(secici([['hizli', 'Hızlı'], ['normal', 'Normal'], ['yavas', 'Yavaş']], s.hiz, (v) => (s.hiz = v)));
    if (mod === 'oda') k.appendChild(el('p', 'aciklama', 'Boş kalan koltuklara oyun başlarken bilgisayar oturur.'));
    pencere(mod === 'oda' ? 'Masa kur' : 'Yeni oyun', k, [
      { yazi: 'Vazgeç' },
      {
        yazi: mod === 'oda' ? 'Masayı kur' : 'Başla',
        sinif: 'altin',
        tikla: () => {
          ayar.sonOyun = s;
          ayarKaydet();
          baglam(); // sesi kullanıcının dokunuşuyla aç
          if (mod === 'oda') socket.emit('odaKur', { ayar: s });
          else socket.emit('bilgisayaraKarsi', { ayar: s });
        },
      },
    ]);
  }

  // =========================================================
  // Ana menü
  // =========================================================
  $('btnBilgisayar').onclick = () => adGerekli(() => yeniOyunPenceresi('bilgisayar'));
  $('btnOnline').onclick = () => adGerekli(() => ekranGoster('lobi'));
  $('btnYardim').onclick = yardimPenceresi;
  $('btnKurallar').onclick = kurallarPenceresi;
  $('btnIstatistik').onclick = istatistikPenceresi;
  $('menuAyar').onclick = ayarlarPenceresi;
  $('menuProfil').onclick = ayarlarPenceresi;

  // =========================================================
  // Lobi
  // =========================================================
  $('lobiGeri').onclick = () => ekranGoster('menu');
  document.querySelectorAll('.sekmeler button').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('.sekmeler button').forEach((x) => x.classList.toggle('secik', x === b));
      $('sekme-masalar').classList.toggle('gizli', b.dataset.sekme !== 'masalar');
      $('sekme-lobiSohbet').classList.toggle('gizli', b.dataset.sekme !== 'lobiSohbet');
      if (b.dataset.sekme === 'lobiSohbet') { lobiOkunmamis = 0; $('lobiRozet').textContent = ''; lobiSohbet.kaydir(); }
    };
  });
  $('btnHizli').onclick = () => { baglam(); socket.emit('hizliOyun'); };
  $('btnMasaKur').onclick = () => yeniOyunPenceresi('oda');
  $('btnKodKatil').onclick = () => {
    const kod = $('kodGir').value.trim().toUpperCase();
    if (kod.length !== 4) return bildir('Masa kodu 4 karakterdir.');
    baglam();
    socket.emit('odayaKatil', kod);
  };
  $('kodGir').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnKodKatil').click(); });

  function masaListesi(liste) {
    const k = $('masaListe');
    k.innerHTML = '';
    if (!liste.length) {
      k.appendChild(el('div', 'bos-not', 'Şu an açık masa yok. "Hızlı oyun" ile hemen bir masa kurabilirsin.'));
      return;
    }
    liste.forEach((m) => {
      const s = el('div', 'masa-satir');
      s.appendChild(el('span', '', '🎲'));
      const b = el('div', 'bilgi');
      b.appendChild(el('b', '', m.ad));
      b.appendChild(el('small', '', m.bicim + (m.bicim !== 'Tek el' ? ' (' + m.deger + ')' : '') + ' · ' + m.dolu + '/4 kişi · kod ' + m.kod));
      s.appendChild(b);
      const katil = el('button', 'dugme altin kucuk', 'Katıl');
      katil.onclick = () => { baglam(); socket.emit('odayaKatil', m.kod); };
      s.appendChild(katil);
      k.appendChild(s);
    });
  }

  // =========================================================
  // Sohbet kutusu (lobi ve masa için ortak)
  // =========================================================
  const HAZIR = ['Merhaba 👋', 'Hoş geldin!', 'İyi oyunlar 🍀', 'Bravo! 👏', 'Hadi ama 😄', 'Şansa bak 😅', 'Çok iyiydi 🔥', 'Bir dakika ⏳', 'Teşekkürler 🙏', 'Görüşürüz 👋'];
  const EMOJI = ['😀', '😂', '😍', '😎', '🤔', '😮', '😢', '😡', '👍', '👏', '🎉', '❤️', '🔥', '🍀', '☕', '🀄'];
  function sohbetKutusu(kap) {
    const liste = el('div', 'mesajlar');
    const hazir = el('div', 'hazir');
    HAZIR.concat(EMOJI).forEach((h) => {
      const b = el('button', '', h);
      b.onclick = () => {
        if (EMOJI.includes(h)) { girdi.value += h; girdi.focus(); }
        else gonder(h);
      };
      hazir.appendChild(b);
    });
    const yazSatir = el('div', 'yaz-satir');
    const girdi = el('input', 'metin-kutu');
    girdi.placeholder = 'Mesaj yaz…';
    girdi.maxLength = 200;
    const gb = el('button', 'dugme altin kucuk', 'Gönder');
    yazSatir.appendChild(girdi);
    yazSatir.appendChild(gb);
    kap.appendChild(liste);
    kap.appendChild(hazir);
    kap.appendChild(yazSatir);
    function gonder(m) {
      m = (m || '').trim();
      if (!m) return;
      socket.emit('sohbet', m);
      girdi.value = '';
    }
    gb.onclick = () => gonder(girdi.value);
    girdi.addEventListener('keydown', (e) => { if (e.key === 'Enter') gonder(girdi.value); e.stopPropagation(); });
    function ekle(m) {
      const d = el('div', 'mesaj' + (m.sistem ? ' sistem' : '') + (!m.sistem && m.token === token.slice(0, 6) ? ' benim' : ''));
      if (m.sistem) d.textContent = m.metin;
      else {
        d.appendChild(el('span', 'kim', m.simge + ' ' + m.isim));
        d.appendChild(document.createTextNode(suzgec(m.metin)));
      }
      const altta = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 60;
      liste.appendChild(d);
      while (liste.children.length > 80) liste.firstChild.remove();
      if (altta) liste.scrollTop = liste.scrollHeight;
    }
    return {
      ekle,
      temizle: () => (liste.innerHTML = ''),
      kaydir: () => setTimeout(() => (liste.scrollTop = liste.scrollHeight), 0),
    };
  }
  const lobiSohbet = sohbetKutusu($('lobiSohbetKutu'));
  const masaSohbet = sohbetKutusu($('masaSohbetKutu'));
  let lobiOkunmamis = 0;
  let masaOkunmamis = 0;

  socket.on('lobiSohbetGecmisi', (l) => { lobiSohbet.temizle(); l.forEach(lobiSohbet.ekle); lobiSohbet.kaydir(); });
  socket.on('lobiSohbet', (m) => {
    lobiSohbet.ekle(m);
    if ($('sekme-lobiSohbet').classList.contains('gizli')) {
      lobiOkunmamis++;
      $('lobiRozet').textContent = '(' + lobiOkunmamis + ')';
    }
  });
  socket.on('sohbetGecmisi', (l) => { masaSohbet.temizle(); l.forEach(masaSohbet.ekle); masaSohbet.kaydir(); });
  socket.on('sohbet', (m) => {
    masaSohbet.ekle(m);
    if (m.sistem) return;
    if (m.token !== token.slice(0, 6)) Ses.mesaj();
    balonGoster(m);
    if (!sohbetAcikMi()) {
      masaOkunmamis++;
      $('sohbetRozet').textContent = masaOkunmamis;
      $('sohbetRozet').classList.remove('gizli');
    }
  });

  // Sohbet paneli: geniş ekranda yanda açık, telefonda düğmeyle açılır
  const genisMi = () => window.matchMedia('(min-width: 1101px)').matches;
  function sohbetAcikMi() {
    const p = $('sohbetPanel').classList;
    return genisMi() ? !p.contains('kapali-masa') : !p.contains('kapali-mobil');
  }
  $('sohbetPanel').classList.add('kapali-mobil');
  $('sohbetDugme').onclick = () => {
    const p = $('sohbetPanel').classList;
    if (genisMi()) p.toggle('kapali-masa');
    else p.toggle('kapali-mobil');
    if (sohbetAcikMi()) {
      masaOkunmamis = 0;
      $('sohbetRozet').classList.add('gizli');
      masaSohbet.kaydir();
    }
  };
  $('sohbetKapat').onclick = () => {
    $('sohbetPanel').classList.add(genisMi() ? 'kapali-masa' : 'kapali-mobil');
  };

  function balonGoster(m) {
    if (!durum) return;
    const i = durum.koltuklar.findIndex((k) => k && !k.bot && k.isim === m.isim);
    if (i === -1) return;
    const oyuncuEl = document.querySelector('.oyuncu[data-koltuk="' + i + '"]');
    if (!oyuncuEl) return;
    const alan = $('masaAlan').getBoundingClientRect();
    const r = oyuncuEl.getBoundingClientRect();
    const b = el('div', 'balon', suzgec(m.metin));
    b.style.left = Math.min(alan.width - 210, Math.max(4, r.left - alan.left)) + 'px';
    const yer = gorunurYer(i);
    if (yer === 0) b.style.top = (r.top - alan.top - 44) + 'px';
    else b.style.top = (r.bottom - alan.top + 6) + 'px';
    $('masaAlan').appendChild(b);
    setTimeout(() => b.remove(), 4600);
  }

  // =========================================================
  // Masa
  // =========================================================
  const YER_SINIF = ['alt-oyuncu', 'sag', 'ust', 'sol'];
  const YIGIN_SINIF = ['y-sag-alt', 'y-sag-ust', 'y-sol-ust', 'y-sol-alt'];
  function gorunurYer(koltuk) { return (koltuk - durum.benim + 4) % 4; }
  function benimSiram() { return durum && durum.durum === 'oyunda' && durum.oyun && durum.oyun.sira === durum.benim; }
  let sonOlayNo = 0;
  let sonSiraBende = false;
  const sayilanEller = new Set();
  const sayilanMaclar = new Set();

  socket.on('oda', (v) => {
    const ilk = !durum || durum.kod !== v.kod;
    const oncekiEl = durum && durum.elNo;
    durum = v;
    if (ekran !== 'masa') ekranGoster('masa');
    if (ilk) {
      masaOkunmamis = 0;
      $('sohbetRozet').classList.add('gizli');
      sonOlayNo = v.sonOlay ? v.sonOlay.no : 0;
    }
    if (v.oyun && (ilk || oncekiEl !== v.elNo)) istakaYukle();
    if (v.oyun) istakaEsitle();
    seslerVeIstatistik(ilk);
    masaCiz();
  });

  function seslerVeIstatistik(ilk) {
    const o = durum.sonOlay;
    if (o && o.no !== sonOlayNo && !ilk) {
      if (o.tur === 'at') Ses.tasAt();
      else if (o.tur === 'cek' || o.tur === 'yandan') Ses.cek();
      else if (o.tur === 'dagit') Ses.dagit();
      else if (o.tur === 'bitti') (o.koltuk === durum.benim ? Ses.kazan : Ses.kaybet)();
    }
    if (o) sonOlayNo = o.no;
    const bende = benimSiram();
    if (bende && !sonSiraBende && !ilk) setTimeout(Ses.sira, 250);
    sonSiraBende = bende;

    // İstatistik
    const s = durum.sonuc;
    const elAnahtar = durum.kod + ':' + durum.elNo;
    if (s && !sayilanEller.has(elAnahtar)) {
      sayilanEller.add(elAnahtar);
      if (!ilk) {
        ist.oynananEl++;
        if (s.kazanan === durum.benim) {
          ist.kazanilanEl++;
          if (s.okeyAtti) ist.okeyBitis++;
          if (s.tur === 'cift') ist.ciftBitis++;
          if (s.elden) ist.eldenBitis++;
          konfeti();
        }
      }
    }
    const m = durum.macSonu;
    if (m && !sayilanMaclar.has(elAnahtar)) {
      sayilanMaclar.add(elAnahtar);
      if (!ilk) {
        ist.oynanan++;
        if (m.kazananlar.includes(durum.benim)) {
          ist.kazanilan++;
          ist.seri++;
          ist.enIyiSeri = Math.max(ist.enIyiSeri, ist.seri);
        } else ist.seri = 0;
      }
    }
    yaz('nso_ist', ist);
  }

  function konfeti() {
    const isaretler = ['🎉', '✨', '⭐', '🎊', '🏆'];
    for (let i = 0; i < 28; i++) {
      const k = el('div', 'konfeti', isaretler[i % isaretler.length]);
      k.style.left = Math.random() * 100 + 'vw';
      k.style.animationDuration = 2 + Math.random() * 2 + 's';
      k.style.animationDelay = Math.random() * 0.6 + 's';
      document.body.appendChild(k);
      setTimeout(() => k.remove(), 5000);
    }
  }

  function masaCiz() {
    const d = durum;
    const o = d.oyun;
    $('bicimCip').textContent = d.bicimAd + (d.ayar.bicim !== 'tek' ? ' ' + d.ayar.deger : '') + (d.elNo ? ' · ' + d.elNo + '. el' : '');
    $('kodCip').textContent = d.ad === 'Bilgisayara karşı' ? '🖥️ Bilgisayara karşı' : '🔗 Masa: ' + d.kod;

    // Oyuncular
    const oy = $('oyuncular');
    oy.innerHTML = '';
    d.koltuklar.forEach((k, i) => {
      if (!k) return;
      const yer = gorunurYer(i);
      const e = el('div', 'oyuncu ' + YER_SINIF[yer]);
      e.dataset.koltuk = i;
      if (o && d.durum === 'oyunda' && o.sira === i) e.classList.add('sirada');
      if (!k.bagli) e.classList.add('kopuk');
      e.appendChild(el('div', 'simge', k.simge));
      const y = el('div');
      y.appendChild(el('div', 'ad', (yer === 0 ? 'Sen · ' : '') + k.isim));
      const alt = [];
      if (o) alt.push(k.tasSayisi + ' taş');
      if (d.ayar.bicim !== 'tek' || d.puanlar[i]) alt.push(d.puanlar[i] + ' puan');
      if (k.bot) alt.push('🤖');
      if (!k.bagli) alt.push('bağlantı yok');
      y.appendChild(el('div', 'alt', alt.join(' · ')));
      e.appendChild(y);
      oy.appendChild(e);
    });

    // Atılan taş yığınları
    const yg = $('yiginlar');
    yg.innerHTML = '';
    if (o) {
      for (let i = 0; i < 4; i++) {
        const yer = gorunurYer(i);
        const y = el('div', 'yigin ' + YIGIN_SINIF[yer]);
        y.dataset.koltuk = i;
        const son = o.sonAtilanlar[i];
        if (son) {
          if (o.atilanSayilari[i] > 1) {
            const alt = tasKutu({ renk: 'kapali', sayi: '' }, 'kapali');
            alt.style.transform = 'translate(-3px,-3px)';
            y.appendChild(alt);
          }
          y.appendChild(tasKutu(son));
          y.style.width = 'var(--tw)';
          y.style.height = 'calc(var(--tw) * 1.38)';
        } else y.classList.add('bos');
        if (yer === 3 && son && benimSiram() && !o.cekti) {
          y.classList.add('alinabilir');
          y.onclick = () => { baglam(); socket.emit('cek', 'yan'); };
        }
        if (yer === 0) y.id = 'atmaYigini';
        yg.appendChild(y);
      }
    }

    // Orta: deste ve gösterge
    const orta = document.querySelector('.orta-alan');
    orta.classList.toggle('gizli', !o);
    if (o) {
      $('desteSayi').textContent = o.kalan;
      const deste = $('deste');
      deste.classList.toggle('cekilebilir', benimSiram() && !o.cekti);
      deste.onclick = () => { if (benimSiram() && !o.cekti) { baglam(); socket.emit('cek', 'orta'); } };
      $('gostergeTas').innerHTML = '';
      $('gostergeTas').appendChild(tasKutu(o.gosterge));
      const oc = $('okeyCip');
      oc.innerHTML = '';
      oc.appendChild(tasKutu(o.okey, 'mini'));
      oc.appendChild(document.createTextNode('Okey'));
      oc.title = 'Okey: ' + RENK_AD[o.okey.renk] + ' ' + o.okey.sayi;
    }

    // Durum yazısı
    const dy = $('durumYazi');
    dy.innerHTML = '';
    if (o && d.durum === 'oyunda') {
      let metin;
      let soluk = false;
      if (benimSiram()) metin = o.cekti ? 'Sıra sende: bir taş at' : 'Sıra sende: ortadan ya da soldan taş al';
      else { metin = d.koltuklar[o.sira].isim + ' oynuyor…'; soluk = true; }
      dy.appendChild(el('span', 'cip' + (soluk ? ' soluk' : ''), metin));
    }

    istakaCiz();
    dugmeleriGuncelle();
    katmanCiz();
  }

  // ---------- Bekleme, el sonu, oyun sonu katmanları ----------
  function katmanCiz() {
    const k = $('katman');
    k.innerHTML = '';
    const d = durum;
    if (d.durum === 'oyunda') return;
    const kat = el('div', 'katman');
    const kart = el('div', 'kart');
    kat.appendChild(kart);

    if (d.durum === 'bekliyor') {
      kart.appendChild(el('h2', '', '👥 Oyuncular bekleniyor'));
      kart.appendChild(el('div', 'aciklama', 'Masa kodunu ya da bağlantıyı arkadaşlarına gönder:'));
      kart.appendChild(el('div', 'kod-buyuk', d.kod));
      const pd = el('div', 'dugmeler');
      const kopya = el('button', 'dugme kucuk', '📋 Bağlantıyı kopyala');
      kopya.onclick = baglantiKopyala;
      pd.appendChild(kopya);
      const wa = el('button', 'dugme kucuk', '💬 WhatsApp ile gönder');
      wa.onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(davetMetni()), '_blank');
      pd.appendChild(wa);
      kart.appendChild(pd);
      const kl = el('div', 'koltuk-liste');
      d.koltuklar.forEach((s) => {
        const e = el('div', s && !s.bot ? '' : 'bos', s && !s.bot ? s.simge + ' ' + s.isim : '🤖 boş (bilgisayar oturacak)');
        kl.appendChild(e);
      });
      kart.appendChild(kl);
      kart.appendChild(el('div', 'aciklama', d.bicimAd + (d.ayar.bicim !== 'tek' ? ' · ' + d.ayar.deger : '') + ' · zorluk: ' + d.ayar.zorluk));
      const db = el('div', 'dugmeler');
      db.style.marginTop = '12px';
      if (d.sahipMi) {
        const b = el('button', 'dugme altin', '▶ Oyunu başlat');
        b.onclick = () => { baglam(); socket.emit('baslat'); };
        db.appendChild(b);
      } else db.appendChild(el('div', 'aciklama', 'Masayı kuran oyunu başlatınca oyun açılacak.'));
      kart.appendChild(db);
    } else {
      const s = d.sonuc;
      const macBitti = d.durum === 'macbitti';
      if (macBitti && d.macSonu) {
        const kazandim = d.macSonu.kazananlar.includes(d.benim);
        kart.appendChild(el('h2', '', d.macSonu.berabere ? '🤝 Berabere' : kazandim ? '🏆 Kazandın!' : '🏆 Kazanan: ' + d.macSonu.isimler.join(', ')));
      }
      if (s) {
        kart.appendChild(el(macBitti ? 'div' : 'h2', macBitti ? 'aciklama' : '', s.aciklama));
        if (s.el) {
          const ke = el('div', 'kazanan-el');
          s.el.forEach((t) => ke.appendChild(t ? tasKutu(t) : el('span', 'bosluk')));
          const ok = el('span', '', '  ⟵ attı: ');
          ok.style.margin = '0 4px 0 10px';
          ke.appendChild(ok);
          ke.appendChild(tasKutu(s.atilan));
          kart.appendChild(ke);
        }
      }
      if (d.ayar.bicim !== 'tek') {
        const tablo = el('table', 'puan-tablo');
        const sira = [0, 1, 2, 3].sort((a, b) => (d.ayar.bicim === 'dusme' ? d.puanlar[a] - d.puanlar[b] : d.puanlar[b] - d.puanlar[a]));
        sira.forEach((i) => {
          const tr = el('tr', s && s.kazanan === i ? 'kazanan' : '');
          tr.appendChild(el('td', '', d.koltuklar[i].simge + ' ' + d.koltuklar[i].isim + (i === d.benim ? ' (sen)' : '')));
          tr.appendChild(el('td', '', d.puanlar[i] + ' puan'));
          tablo.appendChild(tr);
        });
        kart.appendChild(tablo);
      }
      const db = el('div', 'dugmeler');
      if (!macBitti) {
        const b = el('button', 'dugme altin', '▶ Sonraki el');
        b.onclick = () => socket.emit('sonrakiEl');
        db.appendChild(b);
      } else {
        if (d.sahipMi) {
          const b = el('button', 'dugme altin', '🔄 Yeni oyun');
          b.onclick = () => socket.emit('baslat');
          db.appendChild(b);
        }
        const c = el('button', 'dugme', 'Masadan çık');
        c.onclick = () => socket.emit('odadanAyril');
        db.appendChild(c);
      }
      kart.appendChild(db);
    }
    k.appendChild(kat);
  }

  function davetMetni() {
    return 'Neşeli Sohbet Oyunlar\'da okey oynayalım! 🀄 Masa kodu: ' + durum.kod + '\n' + location.origin + '/?masa=' + durum.kod;
  }
  function baglantiKopyala() {
    const metin = location.origin + '/?masa=' + durum.kod;
    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      navigator.share({ title: 'Okey masası', text: davetMetni() }).catch(() => {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(metin) : Promise.reject())
      .then(() => bildir('Bağlantı kopyalandı: ' + metin))
      .catch(() => bildir('Masa kodu: ' + durum.kod));
  }
  $('kodCip').onclick = () => { if (durum && durum.ad !== 'Bilgisayara karşı') baglantiKopyala(); };

  $('masaMenu').onclick = () => {
    const k = el('div');
    k.style.display = 'flex';
    k.style.flexDirection = 'column';
    k.style.gap = '10px';
    const p = pencere('Menü', k);
    [['📖 Kurallar', kurallarPenceresi], ['💡 Nasıl oynanır?', yardimPenceresi], ['⚙️ Ayarlar', ayarlarPenceresi], ['📊 İstatistikler', istatistikPenceresi],
      ['🚪 Masadan çık', () => {
        if (durum && durum.durum === 'oyunda') {
          pencere('Masadan çık', '<p>El sürüyor. Çıkarsan yerine bilgisayar oynayacak. Emin misin?</p>', [{ yazi: 'Vazgeç' }, { yazi: 'Çık', sinif: 'altin', tikla: () => socket.emit('odadanAyril') }]);
        } else socket.emit('odadanAyril');
      }]].forEach(([y, f]) => {
      const b = el('button', 'dugme', y);
      b.onclick = () => { p.kapa(); f(); };
      k.appendChild(b);
    });
  };
  $('sesDugme').onclick = () => { ayar.ses = !ayar.ses; ayarKaydet(); if (ayar.ses) Ses.tasKoy(); };

  // =========================================================
  // İstaka (2 sıra × 15 yuva)
  // =========================================================
  const istaka = { yuvalar: new Array(30).fill(null), anahtar: '' };
  let seciliId = null;
  let yeniId = null;

  function istakaYukle() {
    istaka.anahtar = 'nso_istaka_' + durum.kod + '_' + durum.elNo;
    let kayit = null;
    try { kayit = JSON.parse(sessionStorage.getItem(istaka.anahtar)); } catch (e) { /* yok */ }
    istaka.yuvalar = Array.isArray(kayit) && kayit.length === 30 ? kayit : new Array(30).fill(null);
    seciliId = null;
    yeniId = null;
  }
  function istakaKaydet() {
    try { sessionStorage.setItem(istaka.anahtar, JSON.stringify(istaka.yuvalar)); } catch (e) { /* yok */ }
  }
  function istakaEsitle() {
    const el2 = durum.oyun.elim;
    const idler = new Set(el2.map((t) => t.id));
    const y = istaka.yuvalar;
    for (let i = 0; i < 30; i++) if (y[i] !== null && !idler.has(y[i])) y[i] = null;
    const yerdekiler = new Set(y.filter((x) => x !== null));
    const yeniler = el2.filter((t) => !yerdekiler.has(t.id));
    if (yerdekiler.size === 0 && yeniler.length > 1) {
      diz('seri', true);
    } else {
      yeniler.forEach((t) => {
        // Yeni çekilen taşı son taşın hemen sağına koy
        let son = -1;
        for (let i = 0; i < 30; i++) if (y[i] !== null) son = i;
        let yer = y.indexOf(null, son + 1);
        if (yer === -1) yer = y.indexOf(null);
        y[yer] = t.id;
        if (yeniler.length === 1) yeniId = t.id;
      });
    }
    if (seciliId !== null && !idler.has(seciliId)) seciliId = null;
    istakaKaydet();
  }

  function tasBul(id) { return durum.oyun.elim.find((t) => t.id === id); }

  function istakaCiz() {
    const k = $('istaka');
    k.innerHTML = '';
    const o = durum.oyun;
    document.querySelector('.alt-bolum').classList.toggle('gizli', !o);
    if (!o) return;
    for (let i = 0; i < 30; i++) {
      const yuva = el('div', 'yuva');
      yuva.dataset.yuva = i;
      const id = istaka.yuvalar[i];
      if (id !== null) {
        const t = tasBul(id);
        if (t) {
          const kutu = tasKutu(t);
          kutu.dataset.id = id;
          if (id === seciliId) kutu.classList.add('secili');
          if (id === yeniId) kutu.classList.add('yeni');
          kutu.addEventListener('pointerdown', (e) => surukBasla(e, id, kutu));
          yuva.appendChild(kutu);
        }
      }
      k.appendChild(yuva);
    }
  }

  // ---------- Sürükle bırak (fare ve dokunmatik) ----------
  let suruk = null;
  let sonDokunus = { id: null, zaman: 0 };
  function surukBasla(e, id, kutu) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    baglam();
    suruk = { id, kutu, x0: e.clientX, y0: e.clientY, basladi: false, hayalet: null, hedef: null };
    window.addEventListener('pointermove', surukHareket);
    window.addEventListener('pointerup', surukBitir);
    window.addEventListener('pointercancel', surukIptal);
  }
  function surukHareket(e) {
    if (!suruk) return;
    if (!suruk.basladi) {
      if (Math.hypot(e.clientX - suruk.x0, e.clientY - suruk.y0) < 7) return;
      suruk.basladi = true;
      const r = suruk.kutu.getBoundingClientRect();
      suruk.dx = suruk.x0 - r.left;
      suruk.dy = suruk.y0 - r.top;
      suruk.hayalet = suruk.kutu.cloneNode(true);
      suruk.hayalet.classList.add('hayalet');
      suruk.hayalet.classList.remove('secili');
      document.body.appendChild(suruk.hayalet);
      suruk.kutu.classList.add('suruklenen');
    }
    suruk.hayalet.style.left = e.clientX - suruk.dx + 'px';
    suruk.hayalet.style.top = e.clientY - suruk.dy + 'px';
    const hedef = hedefBul(e.clientX, e.clientY);
    if (suruk.hedef && suruk.hedef !== hedef) suruk.hedef.classList.remove('hedef');
    if (hedef) hedef.classList.add('hedef');
    suruk.hedef = hedef;
  }
  function hedefBul(x, y) {
    const altindaki = document.elementFromPoint(x, y);
    if (!altindaki) return null;
    const yuva = altindaki.closest('.yuva');
    if (yuva) return yuva;
    const o = durum.oyun;
    const atabilir = benimSiram() && o.cekti;
    if (atabilir && altindaki.closest('#atmaYigini')) return $('atmaYigini');
    if (atabilir && altindaki.closest('#gostergeKutu')) return $('gostergeKutu');
    return null;
  }
  function surukTemizle() {
    window.removeEventListener('pointermove', surukHareket);
    window.removeEventListener('pointerup', surukBitir);
    window.removeEventListener('pointercancel', surukIptal);
    if (suruk) {
      if (suruk.hayalet) suruk.hayalet.remove();
      if (suruk.hedef) suruk.hedef.classList.remove('hedef');
      suruk.kutu.classList.remove('suruklenen');
    }
  }
  function surukIptal() { surukTemizle(); suruk = null; }
  function surukBitir(e) {
    if (!suruk) return;
    const s = suruk;
    surukTemizle();
    suruk = null;
    if (!s.basladi) {
      // Tıklama: seç; hızlı ikinci dokunuş: at
      const simdi = Date.now();
      if (sonDokunus.id === s.id && simdi - sonDokunus.zaman < 380) {
        sonDokunus = { id: null, zaman: 0 };
        tasAt(s.id);
        return;
      }
      sonDokunus = { id: s.id, zaman: simdi };
      seciliId = seciliId === s.id ? null : s.id;
      istakaCiz();
      dugmeleriGuncelle();
      return;
    }
    const h = s.hedef;
    if (!h) { istakaCiz(); return; }
    if (h.id === 'atmaYigini') return tasAt(s.id);
    if (h.id === 'gostergeKutu') return eliBitir(s.id);
    yuvayaTasi(s.id, parseInt(h.dataset.yuva, 10));
  }

  function yuvayaTasi(id, hedef) {
    const y = istaka.yuvalar;
    const kaynak = y.indexOf(id);
    if (kaynak === hedef) { istakaCiz(); return; }
    y[kaynak] = null;
    if (y[hedef] !== null) {
      // Doluysa taşları aynı sıra içinde boş yere doğru kaydır
      const satirBas = hedef < 15 ? 0 : 15;
      const satirSon = satirBas + 14;
      let bos = -1;
      for (let i = hedef + 1; i <= satirSon; i++) if (y[i] === null) { bos = i; break; }
      if (bos !== -1) {
        for (let i = bos; i > hedef; i--) y[i] = y[i - 1];
      } else {
        for (let i = hedef - 1; i >= satirBas; i--) if (y[i] === null) { bos = i; break; }
        if (bos !== -1) for (let i = bos; i < hedef; i++) y[i] = y[i + 1];
        else { y[kaynak] = y[hedef]; }
      }
    }
    y[hedef] = id;
    if (yeniId === id) yeniId = null;
    Ses.tasKoy();
    istakaKaydet();
    istakaCiz();
  }

  // ---------- Otomatik dizme ----------
  function deger(t) {
    const o = durum.oyun.okey;
    return t.renk === 'sahte' ? { renk: o.renk, sayi: o.sayi } : t;
  }
  const RENK_SIRA = { kirmizi: 0, sari: 1, mavi: 2, siyah: 3 };
  function diz(tur, sessiz) {
    const taslar = durum.oyun.elim.slice();
    const jokerler = taslar.filter(okeyMi);
    let kalan = taslar.filter((t) => !okeyMi(t));
    const gruplar = [];
    const sirala = (a, b) => RENK_SIRA[deger(a).renk] - RENK_SIRA[deger(b).renk] || deger(a).sayi - deger(b).sayi;

    if (tur === 'seri') {
      for (const renk of Object.keys(RENK_SIRA)) {
        const bu = kalan.filter((t) => deger(t).renk === renk).sort(sirala);
        const tekil = [];
        const fazla = [];
        bu.forEach((t) => (tekil.length && deger(tekil[tekil.length - 1]).sayi === deger(t).sayi ? fazla : tekil).push(t));
        // 1'i 13'ün arkasına da koyabilmek için
        const parcalar = [];
        let p = [];
        tekil.forEach((t) => {
          if (p.length && deger(t).sayi !== deger(p[p.length - 1]).sayi + 1) { parcalar.push(p); p = []; }
          p.push(t);
        });
        if (p.length) parcalar.push(p);
        if (parcalar.length > 1 && deger(parcalar[0][0]).sayi === 1 && deger(parcalar[parcalar.length - 1].slice(-1)[0]).sayi === 13) {
          parcalar[parcalar.length - 1] = parcalar[parcalar.length - 1].concat(parcalar.shift());
        }
        parcalar.forEach((pp) => (pp.length >= 3 ? gruplar.push(pp) : fazla.push(...pp)));
        kalan = kalan.filter((t) => deger(t).renk !== renk).concat(fazla);
      }
    } else if (tur === 'per') {
      for (let sayi = 1; sayi <= 13; sayi++) {
        const bu = kalan.filter((t) => deger(t).sayi === sayi).sort(sirala);
        const renkler = new Map();
        bu.forEach((t) => { if (!renkler.has(deger(t).renk)) renkler.set(deger(t).renk, t); });
        if (renkler.size >= 3) {
          const g = [...renkler.values()];
          gruplar.push(g);
          kalan = kalan.filter((t) => !g.includes(t));
        }
      }
    } else if (tur === 'cift') {
      const sirali = kalan.slice().sort(sirala);
      const kullanilan = new Set();
      for (let i = 0; i < sirali.length - 1; i++) {
        const a = sirali[i];
        const b = sirali[i + 1];
        if (!kullanilan.has(a) && !kullanilan.has(b) && deger(a).renk === deger(b).renk && deger(a).sayi === deger(b).sayi) {
          gruplar.push([a, b]);
          kullanilan.add(a);
          kullanilan.add(b);
          i++;
        }
      }
      kalan = kalan.filter((t) => !kullanilan.has(t));
    }
    kalan.sort(sirala);
    const parcalar = gruplar.slice();
    // Kalanları renge göre küçük parçalara ayır
    let p = [];
    kalan.forEach((t) => {
      if (p.length && deger(p[p.length - 1]).renk !== deger(t).renk && tur !== 'cift') { parcalar.push(p); p = []; }
      p.push(t);
    });
    if (p.length) parcalar.push(p);
    if (jokerler.length) parcalar.push(jokerler);
    yerlestir(parcalar);
    if (!sessiz) { Ses.dagit(); istakaKaydet(); istakaCiz(); }
  }
  function yerlestir(parcalar) {
    const y = new Array(30).fill(null);
    let i = 0;
    let sigdi = true;
    for (const pr of parcalar) {
      const satirSonu = i < 15 ? 15 : 30;
      if (i + pr.length > satirSonu && i < 15 && pr.length <= 15) i = 15;
      if (i + pr.length > 30) { sigdi = false; break; }
      pr.forEach((t) => (y[i++] = t.id));
      if (i < 30 && i !== 15) i++; // gruplar arasında boşluk
    }
    if (!sigdi) {
      // Boşluksuz sırala
      const hepsi = parcalar.flat();
      y.fill(null);
      hepsi.forEach((t, j) => (y[j] = t.id));
    }
    istaka.yuvalar = y;
  }
  $('dizDugme').onclick = () => $('dizMenu').classList.toggle('gizli');
  document.querySelectorAll('#dizMenu button').forEach((b) => {
    b.onclick = () => { $('dizMenu').classList.add('gizli'); if (durum && durum.oyun) diz(b.dataset.diz); };
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#dizMenu') && !e.target.closest('#dizDugme')) $('dizMenu').classList.add('gizli');
  });

  // ---------- At ve Bitir ----------
  function bitirenTas() {
    const o = durum.oyun;
    if (!benimSiram() || !o.cekti || o.elim.length !== 15 || !window.Bitis) return null;
    const adaylar = o.elim.slice().sort((a, b) => (b.id === seciliId) - (a.id === seciliId) || okeyMi(b) - okeyMi(a));
    for (const t of adaylar) {
      if (window.Bitis.bitisTuru(o.elim.filter((x) => x !== t), o.okey)) return t;
    }
    return null;
  }
  function dugmeleriGuncelle() {
    if (!durum || !durum.oyun) return;
    const o = durum.oyun;
    $('atDugme').disabled = !(benimSiram() && o.cekti && seciliId !== null);
    const b = bitirenTas();
    $('bitirDugme').disabled = !b;
    $('bitirDugme').classList.toggle('parla', !!b);
  }
  function tasAt(id) {
    const o = durum.oyun;
    if (!benimSiram()) return bildir('Sıra sende değil.');
    if (!o.cekti) return bildir('Önce bir taş almalısın.');
    seciliId = null;
    socket.emit('at', id);
  }
  function eliBitir(id) {
    const o = durum.oyun;
    if (!benimSiram() || !o.cekti) return bildir('Bitirmek için sıranın gelmesi ve taş almış olman gerekir.');
    socket.emit('bitir', { tasId: id, dizilim: istaka.yuvalar });
  }
  $('atDugme').onclick = () => { if (seciliId !== null) tasAt(seciliId); };
  $('bitirDugme').onclick = () => {
    const t = bitirenTas();
    if (t) eliBitir(t.id);
  };

  // Klavye: Enter seçili taşı atar
  document.addEventListener('keydown', (e) => {
    if (ekran !== 'masa' || e.target.tagName === 'INPUT') return;
    if (e.key === 'Enter' && seciliId !== null) tasAt(seciliId);
  });

  // =========================================================
  // Başlangıç
  // =========================================================
  temaUygula();
  // Arka plandaki süs taşları
  [['7', 'kirmizi', 8, 30], ['3', 'mavi', 18, 70], ['11', 'siyah', 80, 25], ['★', 'sahte', 88, 72], ['5', 'sari', 30, 85]].forEach(([s, r, x, y], i) => {
    const t = el('div', 'tas sus-tas ' + r, s);
    t.style.left = x + '%';
    t.style.top = y + '%';
    t.style.transform = 'rotate(' + (i * 37 - 40) + 'deg)';
    $('menu').appendChild(t);
  });
  if (!ayar.isim) setTimeout(() => hosgeldin(() => { if (bekleyenKod) { socket.emit('odayaKatil', bekleyenKod); bekleyenKod = null; } }), 300);
  else if (bekleyenKod) ekranGoster('lobi');
})();

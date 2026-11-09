// Ek soru dosyalarını (cat0.js ... cat6.js) tek listede toplar.
// Yeni bir kategori dosyası eklemek için buraya import edip EXTRA listesine koymak yeterli.
import cat0 from './cat0.js';
import cat1 from './cat1.js';
import cat2 from './cat2.js';
import cat3 from './cat3.js';
import cat4 from './cat4.js';
import cat5 from './cat5.js';
import cat6 from './cat6.js';

/**
 * Elle incelemede hatalı / belirsiz bulunan satırlar (dosyadaki sıra numarası, 0'dan başlar).
 * Dosyalara dokunmadan buradan elenir; nedenleri aşağıda.
 */
const REMOVED = new Map([
  [cat3, [
    43, // "Onikiada hangi gruba aittir" - anlatım bozuk, şıklar karışık dilde
  ]],
  [cat4, [
    36, // Amasya Genelgesi ifadesi "ne anlama gelir" - anlatım belirsiz
    40, // Mustafa Kemal'in Erzurum'daki sıfatı "Delege (milletvekili)" - yanıltıcı
    50, // "Amerikan mandasına ilk kez karşı çıkan görüşme" - anlatım bozuk
    51, // "Sivas'ın telgraf hatları kesilmiştir" - tarihsel dayanağı belirsiz
    68, // TBMM'nin açılışında "yetkiler" - anlatım belirsiz
    69, // TBMM'nin açılış günü "hangi dua ile ve nerede" - anlatım bozuk
    75, // Sevr "benimsenmediği için ne yapılmıştır" - anlatım bozuk
    79, // "Kendisini tek yetkili ilan etmesi" bir karar olarak sunulmuş - belirsiz
    80, // "İstanbul Hükümeti ile ilişkiyi kesen olay: Sevr" - tarihsel olarak tartışmalı
    85, // "Kuva-yi Milliye düzenli ordu ile ... hangi gelişme sonrası" - anlatım bozuk
    86, // "Kuva-yi Milliye ... önleyememiştir" - anlatım mantıksız
    96, // İstiklal Marşı ödülü ile ilgili soru - olgusal olarak yanlış kurgulanmış
    142, // Kilikyalılar Cemiyeti "Ermenilerle birlikte hareket eden" - YANLIŞ bilgi
  ]],
  [cat6, [
    49, // iki şıkta neredeyse aynı antlaşma adı - tek doğru yok
    65, // Toprak Mahsulleri Ofisi "DP döneminde kuruldu" - YANLIŞ (1938)
    68, // soru metninde yazım hatası ("adadadır")
    75, // MGK da 1961 Anayasası ile kuruldu - birden çok doğru şık
    82, // "EOKA-B lideri Sampson" - YANLIŞ (EOKA-B lideri Grivas)
    83, // "Makarios'u deviren kişi Sampson" - belirsiz/tartışmalı
  ]],
]);

const EXTRA = [cat0, cat1, cat2, cat3, cat4, cat5, cat6];

const DIFFICULTIES = ['kolay', 'orta', 'zor'];

/** Satır biçimi: [kategoriIndex, soru, A, B, C, D, doğruIndex, zorluk] */
function isValidRow(r) {
  if (!Array.isArray(r) || r.length !== 8) return false;
  const [cat, q, a, b, c, d, correct, diff] = r;
  if (!Number.isInteger(cat) || cat < 0 || cat > 6) return false;
  if (typeof q !== 'string' || q.trim().length < 8) return false;
  const opts = [a, b, c, d];
  if (opts.some((o) => typeof o !== 'string' || !o.trim())) return false;
  if (new Set(opts.map((o) => o.trim().toLocaleLowerCase('tr'))).size !== 4) return false;
  if (![0, 1, 2, 3].includes(correct)) return false;
  return DIFFICULTIES.includes(diff);
}

export default EXTRA
  .flatMap((rows) => {
    const removed = new Set(REMOVED.get(rows) || []);
    return rows.filter((_, i) => !removed.has(i));
  })
  .filter(isValidRow);

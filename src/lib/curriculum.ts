// Eğitim müfredatı: hatlar, seriler, aşamalar (bloklar), kavram dersleri ve sırayı seçen saf fonksiyonlar (tests/unit.test.ts).
// Katalog veritabanına yalnızca eklenir (lib/lessons.ts seedCurriculum): anahtarlar kalıcıdır, değiştirilmez ve silinmez;
// derslerdeki [[anahtar]] bağlantıları ve önkoşullar onlara dayanır. Yeni konu = yeni anahtar; sıra panelden değişir.

export const TRACKS = { uygulama: 'Uygulama', astronomi: 'Astronomi', temel: 'Temel bilim', kavram: 'Kavramlar' } as const
export type Track = keyof typeof TRACKS
export const isTrack = (value: unknown): value is Track => typeof value === 'string' && Object.hasOwn(TRACKS, value)

export const TRACK_HINTS: Record<Track, string> = {
  uygulama: 'Yazılım, gözlem, veri indirgeme, görüntü işleme, fotometri, tayf: elle yapılan iş',
  astronomi: 'Gökyüzünden evrene: gözlemin ve astrofiziğin konuları',
  temel: 'Astronominin dayandığı fizik ve matematik',
  kavram: 'Tek derslik "astronomi kültürü": ne olduğu, ne işe yaradığı',
}

type Stage3 = 'temel' | 'orta' | 'ileri'
type SeriesDef = { key: string; title: string; track: Exclude<Track, 'kavram'>; summary: string; stages: Partial<Record<Stage3, string>> }

// Aşama metni planlayıcıya gider: önerilen dersler ve kapsam. Sayı yaklaşıktır, planlayıcı araştırıp kesinleştirir
export const SERIES: SeriesDef[] = [
  // Uygulama
  { key: 'python', title: 'Python ile Astronomi', track: 'uygulama', summary: 'Astronomide kullanılan Python: kurulumdan kendi analiz paketine.', stages: {
    temel: '4 ders: terminal, kurulum (conda ya da venv) ve Jupyter · Python dilinin temelleri · NumPy ve matplotlib · Astropy ile birimler ve bir FITS dosyasını açmak',
    orta: '4 ders: Astropy tabloları ve pandas · astroquery ve ADQL ile Gaia arşivini sorgulamak · Git ile sürüm takibi · sayısal yöntemler (kök bulma, integral, ODE çözümü)',
    ileri: '3 ders: performanslı kod (vektörleştirme, numba) · kendi analiz paketini yazmak · iyi bilimsel yazılım pratikleri (test, belge, yeniden üretilebilirlik)',
  } },
  { key: 'gozlem', title: 'Gözlem', track: 'uygulama', summary: 'Gözlemi planlamaktan teleskop başında veri toplamaya.', stages: {
    temel: '2 ders: Stellarium ile gökyüzünü tanımak ve gözlem planı · görünürlük, hava kütlesi ve en iyi gözlem saati (astroplan)',
    orta: '3 ders: teleskop kurulumu ve kutup hizalama · poz süresi, kazanç ve filtre seçimi · kılavuzlama (guiding) ve gözlem günlüğü',
  } },
  { key: 'veri-indirgeme', title: 'Veri İndirgeme', track: 'uygulama', summary: 'Ham CCD görüntüsünden bilimsel olarak kullanılabilir veriye.', stages: {
    temel: '3 ders: bir CCD görüntüsünde ne var · bias, dark ve flat: neden ve nasıl · DS9 ile görüntüye bakmak ve ölçmek',
    orta: '3 ders: ccdproc ile indirgeme hattı · S/N denklemi ve poz süresi hesabı · piksel ölçeği ve Nyquist örneklemesi',
  } },
  { key: 'goruntu-isleme', title: 'Görüntü İşleme ve OpenCV', track: 'uygulama', summary: 'Astronomik görüntülerde filtreleme, kaynak bulma, hizalama ve istifleme; OpenCV, scikit-image ve Astropy ile.', stages: {
    temel: '3 ders: dijital görüntü (piksel, bit derinliği, bantlar) · OpenCV ile görüntü açma, filtreleme, histogram · eşikleme ve kaynak bulma',
    orta: '5 ders: hizalama (WCS ve özellik eşleme) · istifleme · gürültü azaltma · morfolojik işlemler · FFT ile frekans uzayında filtreleme',
    ileri: '3 ders: dekonvolüsyon · fark görüntüleme · geniş alan taramalarında görüntü işleme',
  } },
  { key: 'fotometri', title: 'Fotometri', track: 'uygulama', summary: 'Yıldızların parlaklığını ölçmek: elle açıklık fotometrisinden uzay fotometrisine.', stages: {
    temel: '3 ders: akı ve kadir · elle açıklık fotometrisi · diferansiyel fotometri ile bir yıldızın parlaklığını ölçmek',
    orta: '4 ders: PSF fotometrisi · mutlak kalibrasyon ve standart yıldızlar · renk–kadir diyagramı · photutils ile fotometri hattı',
    ileri: '3 ders: TESS ile uzay fotometrisi · yüksek kesinlikli ışık eğrileri · sistematik düzeltme',
  } },
  { key: 'tayf', title: 'Tayf Analizi', track: 'uygulama', summary: 'Tayf görüntüsünden fiziksel bilgiye: kalibrasyon, çizgi ölçümü, dikine hız.', stages: {
    temel: '2 ders: tayf görüntüsü (iki boyuttan bir boyuta) · dalga boyu kalibrasyonu ve çizgileri tanımak',
    orta: '3 ders: akı kalibrasyonu · eşdeğer genişlik ve çizgi ölçümü · dikine hız (specutils)',
    ileri: '4 ders: eşel tayf indirgeme · çizgi profili analizi · bolluk analizine giriş · yüksek kesinlikli dikine hız',
  } },
  { key: 'astrometri', title: 'Astrometri', track: 'uygulama', summary: 'Görüntüde konum ölçmek.', stages: {
    orta: '3 ders: plaka çözümü (astrometry.net) · WCS · öz hareket ve paralaks ölçümü',
  } },
  { key: 'isik-egrisi', title: 'Işık Eğrisi Analizi', track: 'uygulama', summary: 'Zamanla değişen parlaklıktan periyot, faz ve gezegen geçişi.', stages: {
    orta: '4 ders: Lomb–Scargle ile periyot bulma · faz katlama · O–C diyagramı · ötegezegen geçişi',
  } },
  { key: 'bilimsel-calisma', title: 'Bilimsel Çalışma Araçları', track: 'uygulama', summary: 'Araştırmanın gündelik araçları.', stages: {
    temel: '3 ders: ADS ve arXiv ile literatür taraması · LaTeX ile makale yazmak · yayın kalitesinde grafik',
  } },
  { key: 'arsiv', title: 'Arşiv Verisiyle Araştırma', track: 'uygulama', summary: 'Gözlemevi ve uzay görevi arşivlerinden veriyle kendi sorusunu çözmek.', stages: {
    orta: '3 ders: Gaia, TESS, MAST ve ESO arşivleri · veriyi bulmak ve indirmek · bir bilimsel soruyu baştan sona arşiv verisiyle çözmek',
  } },
  { key: 'model-uydurma', title: 'Model Uydurma ve Çıkarım', track: 'uygulama', summary: 'Gözlemi fiziksel modelle karşılaştırmak; kodla.', stages: {
    ileri: '5 ders: en küçük kareler · ki-kare ve hata çubukları · Bayes çıkarımı · MCMC (emcee) · model seçimi',
  } },
  { key: 'simulasyon', title: 'Simülasyon', track: 'uygulama', summary: 'Sayısal modellerle deney.', stages: {
    ileri: '4 ders: N-cisim benzetimi (REBOUND) · yörünge entegrasyonu · Monte Carlo yöntemleri · MESA ile yıldız evrimi modeli',
  } },
  { key: 'makine-ogrenmesi', title: 'Makine Öğrenmesi ile Astronomi', track: 'uygulama', summary: 'Astronomik veride makine öğrenmesi.', stages: {
    ileri: '3 ders: sınıflandırma (yıldız, galaksi, kuasar) · regresyon (fotometrik kırmızıya kayma) · sinir ağlarıyla görüntü',
  } },
  { key: 'uzaktan-algilama', title: 'Uzaktan Algılama', track: 'uygulama', summary: 'Uydu görüntüleriyle Dünya gözlemi.', stages: {
    orta: '4 ders: uydu görüntüleri ve bantlar · bant oranları ve NDVI · atmosfer düzeltmesi · CBS (coğrafi bilgi sistemleri) ile çalışmaya giriş',
  } },
  { key: 'radyo-gozlem', title: 'Radyo Gözlemi', track: 'uygulama', summary: 'Ucuz donanımla radyo astronomi.', stages: {
    orta: '2 ders: SDR ile radyo gözlemi · 21 cm hattıyla Samanyolu\'nun dönmesini ölçmek',
  } },
  { key: 'bilime-katki', title: 'Bilime Katkı', track: 'uygulama', summary: 'Amatör gözlemle bilimsel veritabanlarına katkı.', stages: {
    temel: '2 ders: AAVSO\'ya değişen yıldız gözlemi göndermek · MPC\'ye asteroit astrometrisi ve Zooniverse projeleri',
  } },

  // Astronomi
  { key: 'konum-zaman', title: 'Gökyüzünde Konum ve Zaman', track: 'astronomi', summary: 'Gök küresinde konum, gök cisimlerinin hareketleri ve zaman.', stages: {
    temel: '4 ders: gök küresi ve koordinatlar · günlük ve yıllık hareket, mevsimler · Ay\'ın evreleri · tutulmalar',
    orta: 'Koordinat dönüşümleri (küresel trigonometriyle) · zaman sistemleri · presesyon ve nütasyon · aberasyon',
    ileri: 'Astrometri ve referans sistemleri (ICRS, Gaia çerçevesi), yüksek kesinlikli konum indirgemesi',
  } },
  { key: 'teleskoplar', title: 'Teleskoplar', track: 'astronomi', summary: 'Teleskopun nasıl görüntü oluşturduğu ve sınırları.', stages: {
    temel: '4 ders: mercek ve ayna · odak uzaklığı ve büyütme · ışık toplama ve ayırma gücü · teleskop türleri ve kurgular',
    orta: 'Plaka ölçeği · optik sapınçlar · kırınım sınırı ve seeing',
    ileri: 'Uyarlamalı optik · koronagraflar ve yüksek kontrast · optik interferometri',
  } },
  { key: 'gezegenler', title: 'Gezegenler ve Güneş Sistemi', track: 'astronomi', summary: 'Güneş Sistemi\'nin cisimleri ve öteki yıldızların gezegenleri.', stages: {
    temel: '4 ders: gezegenler · uydular · küçük cisimler · kuyruklu yıldızlar ve meteor yağmurları',
    orta: 'Gezegen oluşumu · ötegezegen bulma yöntemleri · gezegen atmosferleri',
    ileri: 'Ötegezegen atmosferlerinin tayfı · gezegen sistemlerinin dinamiği',
  } },
  { key: 'yildizlar', title: 'Yıldızlar', track: 'astronomi', summary: 'Yıldızların özellikleri, yapısı ve evrimi.', stages: {
    temel: '4 ders: yıldız nedir · HR diyagramı · kütle–ışınım gücü ilişkisi · yıldızların yaşam öyküsü',
    orta: 'Yıldız atmosferi ve tayf türleri · yıldızın iç yapısı · yıldız evrimi',
    ileri: 'Yapı denklemleri ve sayısal çözümü · son evreler (beyaz cüce, nötron yıldızı, kara delik)',
  } },
  { key: 'gozlem-kosullari', title: 'Atmosfer ve Gözlem Koşulları', track: 'astronomi', summary: 'Yer atmosferinin gözleme etkisi.', stages: {
    temel: '2 ders: atmosfer pencereleri ve sönümleme · seeing ve ışık kirliliği',
  } },
  { key: 'tarih', title: 'Astronomi Tarihi', track: 'astronomi', summary: 'Gökyüzünü anlama çabasının öyküsü.', stages: {
    temel: '3 ders: antik çağ astronomisi · İslam dünyası ve Anadolu\'da astronomi (Uluğ Bey, Takiyüddin, İstanbul Rasathanesi) · Kopernik\'ten bugüne',
  } },
  { key: 'degisen-cift', title: 'Değişen ve Çift Yıldızlar', track: 'astronomi', summary: 'Parlaklığı değişen yıldızlar ve çift sistemler.', stages: {
    temel: '3 ders: değişen yıldız türleri · çift yıldızlar · örten çiftler',
    orta: 'Periyot–ışınım gücü ilişkisi · çift yıldızlarla kütle ölçümü',
    ileri: 'Etkileşen çiftler ve kütle aktarımı · asterosismoloji',
  } },
  { key: 'gunes', title: 'Güneş ve Uzay Ortamı', track: 'astronomi', summary: 'En yakın yıldızımız ve Dünya\'ya etkisi.', stages: {
    temel: '3 ders: Güneş\'in katmanları · Güneş lekeleri ve etkinlik · güneş rüzgârı ve kutup ışıkları',
    orta: 'Güneş etkinlik döngüsü · uzay havası',
    ileri: 'Güneş dinamosu · manyetik yeniden bağlanma ve patlamalar',
  } },
  { key: 'uzay-ucusu', title: 'Uzay Uçuşu ve Görevler', track: 'astronomi', summary: 'Uzaya nasıl gidilir, uzay araçları nasıl çalışır.', stages: {
    temel: '3 ders: roket denklemi ve yörüngeye çıkış · uydu yörüngeleri · gezegenler arası yolculuk',
    orta: 'Yörünge manevraları · uzay araçlarının bilimsel aletleri',
  } },
  { key: 'galaksiler', title: 'Galaksiler', track: 'astronomi', summary: 'Samanyolu\'ndan galaksi evrimine.', stages: {
    temel: '3 ders: Samanyolu · galaksi türleri · Yerel Grup',
    orta: 'Dönme eğrileri · karanlık madde · galaksi kümeleri',
    ileri: 'Etkin galaksi çekirdekleri (AGN) · galaksi evrimi',
  } },
  { key: 'kozmoloji', title: 'Kozmoloji', track: 'astronomi', summary: 'Evrenin bütünü: yapısı, geçmişi ve geleceği.', stages: {
    temel: '3 ders: genişleyen evren · Büyük Patlama · evrenin yaşı',
    orta: 'Hubble yasası ve uzaklık merdiveni · kozmik mikrodalga arka plan ışınımı · ilk çekirdeklerin oluşumu',
    ileri: 'Friedmann denklemleri · enflasyon · yapı oluşumu · karanlık enerji',
  } },
  { key: 'gorunmeyen-isik', title: 'Görünmeyen Işıkla Astronomi', track: 'astronomi', summary: 'Radyodan gama ışınlarına farklı dalga boylarında evren.', stages: {
    temel: '3 ders: neden farklı dalga boyları · radyo ve kızılötesi · X ve gama ışınları',
    orta: 'Radyo, kızılötesi ve X ışını gözlem teknikleri',
    ileri: 'Radyo interferometrisi · çok habercili astronomi',
  } },
  { key: 'yuksek-enerji', title: 'Yüksek Enerji Evreni', track: 'astronomi', summary: 'Evrenin en uç cisimleri ve olayları.', stages: {
    temel: '3 ders: nötron yıldızları · kara delikler · süpernovalar',
    orta: 'Atarcalar · birikim diskleri · X ışını çiftleri',
    ileri: 'Gama ışını patlamaları · kütleçekim dalgası kaynakları · kozmik ışınlar',
  } },
  { key: 'yildizlararasi', title: 'Yıldızlararası Ortam', track: 'astronomi', summary: 'Yıldızların arasındaki gaz ve toz.', stages: {
    temel: '2 ders: bulutsular · toz ve gaz',
    orta: 'HII bölgeleri · 21 cm hattı · moleküler bulutlar',
    ileri: 'Yıldız oluşumu ve Jeans kararsızlığı · astrokimya',
  } },
  { key: 'astrobiyoloji', title: 'Astrobiyoloji', track: 'astronomi', summary: 'Evrende yaşamın koşulları ve aranması.', stages: {
    temel: '2 ders: yaşamın koşulları · Güneş Sistemi\'nde ve ötesinde yaşam arayışı',
    orta: 'Biyo-işaretler · yaşanabilirlik ölçütleri',
  } },

  // Temel bilim
  { key: 'olcum', title: 'Ölçüm, Belirsizlik ve İstatistik', track: 'temel', summary: 'Bir ölçümün ne kadar güvenilir olduğunu bilmek.', stages: {
    temel: 'Birimler ve bilimsel gösterim · büyüklük mertebesi tahmini · hata, ortalama ve yayılım',
    orta: 'Olasılık dağılımları (Poisson, normal) · hata yayılımı · en küçük kareler · ki-kare',
    ileri: 'Bayes çıkarımı · MCMC · zaman serileri',
  } },
  { key: 'degisim', title: 'Değişim ve Birikim', track: 'temel', summary: 'Değişimin ve birikimin matematiği: logaritmadan diferansiyel denklemlere.', stages: {
    temel: 'Oran ve eğim, alan · logaritma ve üstel büyüme · küçük açı yaklaşımı',
    orta: 'Türev · integral · Taylor açılımı · diferansiyel denklemler · sayısal çözüm',
    ileri: 'Kısmi türevli denklemler',
  } },
  { key: 'geometri', title: 'Geometri, Vektörler ve Koordinatlar', track: 'temel', summary: 'Uzayda konum ve yön.', stages: {
    temel: 'Vektörler ve açılar · konikler (yörüngelerin şekli) · küresel üçgene giriş',
    orta: 'Küresel trigonometri · matrisler ve dönme · koordinat dönüşümleri',
    ileri: 'Vektör analizi · tensör sezgisi',
  } },
  { key: 'hareket', title: 'Hareket, Kuvvet ve Kütleçekim', track: 'temel', summary: 'Newton\'dan gök mekaniğine.', stages: {
    temel: 'Newton yasaları · enerji · Kepler yasaları',
    orta: 'Açısal momentum · iki cisim problemi · yörünge elemanları · gelgitler',
    ileri: 'Lagrange ve Hamilton mekaniği · üç cisim problemi · rezonanslar',
  } },
  { key: 'isik', title: 'Işık ve Elektromanyetik Işınım', track: 'temel', summary: 'Astronominin tek habercisi: ışık.', stages: {
    temel: 'Geometrik optik (kırılma, mercek ve ayna denklemi) · tayf · foton',
    orta: 'Girişim · kırınım · kutuplanma · Planck yasası · ışınım aktarımına giriş',
    ileri: 'Senkrotron ışınımı · ters Compton saçılması · Einstein katsayıları',
  } },
  { key: 'isi', title: 'Isı, Sıcaklık ve Enerji', track: 'temel', summary: 'Termodinamik ve istatistiksel fizik.', stages: {
    temel: 'Sıcaklık · ideal gaz · enerji ve aktarımı',
    orta: 'Termodinamik yasaları · entropi · Boltzmann ve Saha denklemleri',
    ileri: 'Kuantum istatistikleri · dejenere madde',
  } },
  { key: 'kuantum', title: 'Kuantum Mekaniği', track: 'temel', summary: 'Atom ölçeğinde fizik.', stages: {
    temel: 'Dalga–parçacık ikiliği · belirsizlik ilkesi',
    orta: 'Schrödinger denklemi · potansiyel kuyusu · tünelleme (yıldızlarda füzyon)',
    ileri: 'Spin · pertürbasyon kuramı · geçiş olasılıkları',
  } },
  { key: 'atom', title: 'Atom, Molekül ve Tayf', track: 'temel', summary: 'Tayf çizgilerinin kaynağı.', stages: {
    temel: 'Atom modelleri · enerji seviyeleri · tayf çizgileri',
    orta: 'Bohr modeli · seçim kuralları · moleküler tayflar',
    ileri: 'Hidrojen atomu · ince yapı · 21 cm hattı · çizgi genişlemesi',
  } },
  { key: 'elektromanyetizma', title: 'Elektrik ve Manyetizma', track: 'temel', summary: 'Alanlar, akımlar ve ışığın doğası.', stages: {
    temel: 'Yük ve elektrik alanı · akım · manyetik alan',
    orta: 'Gauss yasası · indüksiyon · Zeeman etkisi · Maxwell denklemleri',
    ileri: 'Elektromanyetik dalgalar · Larmor formülü · plazmada alanlar',
  } },
  { key: 'dalgalar', title: 'Dalgalar, Frekanslar ve Fourier', track: 'temel', summary: 'Periyodik olanın matematiği.', stages: {
    temel: 'Periyot ve frekans · dalgaların üst üste binmesi',
    orta: 'Kompleks sayılar · Fourier serisi ve dönüşümü · konvolüsyon · Nyquist örneklemesi',
    ileri: 'FFT · filtreleme · özel fonksiyonlar (Bessel, Legendre)',
  } },
  { key: 'cekirdek', title: 'Çekirdek, Parçacıklar ve Yıldız Enerjisi', track: 'temel', summary: 'Yıldızları yakan fizik.', stages: {
    temel: 'Atom çekirdeği · füzyon',
    orta: 'Proton–proton zinciri · CNO döngüsü · Gamow tepesi · nötrinolar',
    ileri: 'Nükleosentez · Standart Model · kozmik ışınlar',
  } },
  { key: 'akiskan', title: 'Akışkanlar, Türbülans ve Plazma', track: 'temel', summary: 'Gazın ve plazmanın hareketi.', stages: {
    temel: 'Basınç · hidrostatik denge',
    orta: 'Akışkan denklemleri · ses dalgaları · şoklar · türbülans ve seeing',
    ileri: 'Plazma · MHD · Alfvén dalgaları · Landau sönümü',
  } },
  { key: 'gorelilik', title: 'Görelilik', track: 'temel', summary: 'Işık hızı, uzay-zaman ve kütleçekim.', stages: {
    temel: 'Işık hızının sabitliği · zaman genişlemesi',
    orta: 'Lorentz dönüşümleri · E = mc² · kütleçekimsel kırmızıya kayma',
    ileri: 'Genel görelilik · kara delikler · kütleçekim dalgaları',
  } },
  { key: 'dedektorler', title: 'Dedektörler ve Elektronik', track: 'temel', summary: 'Işığı ölçülebilir sayıya çeviren fizik.', stages: {
    temel: 'Yarı iletkenler · ışıktan elektriğe',
    orta: 'Bant yapısı · CCD ve CMOS\'un fiziği · ADC ve gürültü',
    ileri: 'Kızılötesi ve süperiletken dedektörler',
  } },
]

// Hatların blok sırası. Uygulama hattı turlarla ilerler: önce bütün becerilerin temeli
export const ORDER: Record<Exclude<Track, 'kavram'>, string[]> = {
  uygulama: [
    'python/temel', 'gozlem/temel', 'veri-indirgeme/temel', 'goruntu-isleme/temel', 'fotometri/temel', 'tayf/temel',
    'python/orta', 'veri-indirgeme/orta', 'gozlem/orta', 'goruntu-isleme/orta', 'fotometri/orta', 'astrometri/orta', 'isik-egrisi/orta', 'tayf/orta', 'bilimsel-calisma/temel',
    'arsiv/orta', 'model-uydurma/ileri', 'simulasyon/ileri', 'makine-ogrenmesi/ileri', 'goruntu-isleme/ileri', 'fotometri/ileri', 'tayf/ileri', 'uzaktan-algilama/orta', 'radyo-gozlem/orta', 'bilime-katki/temel', 'python/ileri',
  ],
  astronomi: [
    'konum-zaman/temel', 'teleskoplar/temel', 'gezegenler/temel', 'yildizlar/temel', 'gozlem-kosullari/temel', 'tarih/temel', 'degisen-cift/temel', 'gunes/temel',
    'uzay-ucusu/temel', 'galaksiler/temel', 'kozmoloji/temel', 'gorunmeyen-isik/temel', 'yuksek-enerji/temel', 'yildizlararasi/temel', 'astrobiyoloji/temel',
    'konum-zaman/orta', 'teleskoplar/orta', 'gezegenler/orta', 'degisen-cift/orta', 'yildizlar/orta', 'gunes/orta', 'uzay-ucusu/orta', 'galaksiler/orta',
    'gorunmeyen-isik/orta', 'yildizlararasi/orta', 'kozmoloji/orta', 'yuksek-enerji/orta', 'astrobiyoloji/orta',
    'konum-zaman/ileri', 'teleskoplar/ileri', 'yildizlar/ileri', 'degisen-cift/ileri', 'gunes/ileri', 'gezegenler/ileri', 'galaksiler/ileri',
    'kozmoloji/ileri', 'gorunmeyen-isik/ileri', 'yuksek-enerji/ileri', 'yildizlararasi/ileri',
  ],
  temel: [
    'olcum/temel', 'degisim/temel', 'geometri/temel', 'isik/temel', 'hareket/temel', 'degisim/orta', 'isi/temel', 'dalgalar/temel', 'atom/temel',
    'kuantum/temel', 'elektromanyetizma/temel', 'cekirdek/temel', 'akiskan/temel', 'gorelilik/temel', 'dedektorler/temel',
    'olcum/orta', 'geometri/orta', 'hareket/orta', 'isik/orta', 'dalgalar/orta', 'isi/orta', 'kuantum/orta', 'atom/orta', 'elektromanyetizma/orta',
    'gorelilik/orta', 'cekirdek/orta', 'akiskan/orta', 'dedektorler/orta',
    'olcum/ileri', 'degisim/ileri', 'geometri/ileri', 'hareket/ileri', 'isik/ileri', 'isi/ileri', 'kuantum/ileri', 'atom/ileri',
    'elektromanyetizma/ileri', 'dalgalar/ileri', 'cekirdek/ileri', 'akiskan/ileri', 'gorelilik/ileri', 'dedektorler/ileri',
  ],
}

// Uygulama hattının ilk turu: bitene kadar her iki dersten biri uygulama, sonra her dört dersten biri
export const FIRST_ROUND = ORDER.uygulama.slice(0, 6)

// Seviye tanımından gelenler (requirementsOf) ve serinin önceki aşaması dışındaki önkoşullar
export const REQUIRES: Record<string, string[]> = {
  'konum-zaman/orta': ['geometri/orta'],
  'teleskoplar/orta': ['isik/orta'],
  'gezegenler/orta': ['hareket/orta'],
  'gezegenler/ileri': ['atom/orta', 'isik/orta'],
  'yildizlar/orta': ['isi/orta', 'atom/orta'],
  'yildizlar/ileri': ['cekirdek/orta', 'akiskan/orta'],
  'degisen-cift/orta': ['hareket/orta'],
  'degisen-cift/ileri': ['akiskan/orta'],
  'gunes/orta': ['elektromanyetizma/orta'],
  'gunes/ileri': ['akiskan/ileri'],
  'uzay-ucusu/orta': ['hareket/orta'],
  'galaksiler/orta': ['hareket/orta'],
  'galaksiler/ileri': ['gorelilik/orta'],
  'kozmoloji/orta': ['gorelilik/orta'],
  'kozmoloji/ileri': ['gorelilik/ileri'],
  'gorunmeyen-isik/orta': ['isik/orta'],
  'gorunmeyen-isik/ileri': ['dalgalar/ileri'],
  'yuksek-enerji/orta': ['gorelilik/orta', 'hareket/orta'],
  'yuksek-enerji/ileri': ['gorelilik/ileri'],
  'yildizlararasi/orta': ['atom/orta'],
  'yildizlararasi/ileri': ['akiskan/orta'],
  'astrobiyoloji/orta': ['atom/orta'],
  'kuantum/orta': ['dalgalar/orta'],
  'atom/orta': ['kuantum/temel'],
  'atom/ileri': ['kuantum/orta'],
  'isi/ileri': ['kuantum/orta'],
  'cekirdek/orta': ['kuantum/orta'],
  'dedektorler/orta': ['kuantum/temel', 'elektromanyetizma/temel'],
  'elektromanyetizma/orta': ['geometri/orta'],
  'akiskan/ileri': ['elektromanyetizma/orta'],
  'gorelilik/orta': ['geometri/orta'],
  'gorelilik/ileri': ['geometri/ileri'],
  'isik/ileri': ['elektromanyetizma/orta'],
}

// Kavram dersleri, gruplu. Anahtar (ilk değer) kalıcıdır; sıra gruplar arasında dönüşümlü (çeşitlilik), her grubun ilki en temeli
export const CONCEPTS: Array<[string, Array<[string, string]>]> = [
  ['Temel ölçüler', [
    ['uzaklik-birimleri', 'Uzaklık birimleri: astronomik birim, ışık yılı, parsek'],
    ['kadir-sistemi', 'Kadir sistemi neden ters ve logaritmik'],
    ['uzaklik-modulu', 'Uzaklık modülü ve mutlak kadir'],
    ['tayf-turleri', 'Tayf türleri ve ışınım sınıfları'],
    ['doppler', 'Doppler etkisi'],
    ['renk-indisi', 'Renk indisi'],
    ['kirmiziya-kayma', 'Kırmızıya kayma türleri'],
    ['bolometrik-duzeltme', 'Bolometrik düzeltme'],
  ]],
  ['Teleskop ve gözlem', [
    ['odak-plaka-olcegi', 'Odak uzaklığı, odak oranı ve plaka ölçeği (odak uzunken neden daha ince ayrıntı görülür)'],
    ['buyutme-isik-toplama', 'Büyütme, ışık toplama gücü ve ayırma gücü'],
    ['kirinim-siniri-seeing', 'Kırınım sınırı ve seeing'],
    ['airy-rayleigh', 'Airy diski ve Rayleigh ölçütü'],
    ['hava-kutlesi', 'Hava kütlesi ve sönümleme'],
    ['isik-kirliligi', 'Işık kirliliği ve Bortle ölçeği'],
    ['filtre-sistemleri', 'Filtre sistemleri (Johnson–Cousins, SDSS)'],
    ['nyquist-piksel-olcegi', 'Nyquist örneklemesi ve piksel ölçeği'],
    ['dawes-siniri', 'Dawes sınırı'],
    ['cikis-pupili', 'Çıkış pupili ve göz merceği seçimi'],
    ['sapinclar', 'Optik sapınçlar'],
    ['strehl', 'Strehl oranı'],
    ['zernike', 'Zernike polinomları ne işe yarar'],
    ['rayleigh-sacilmasi', 'Rayleigh saçılması: gök neden mavi'],
    ['atmosferik-kirilma', 'Atmosferik kırılma ve yeşil şimşek'],
    ['interferometri-taban', 'İnterferometri: taban çizgisi ve uv düzlemi'],
    ['stokes', 'Stokes parametreleri'],
  ]],
  ['Dedektör ve veri', [
    ['sn-denklemi', 'S/N denklemi'],
    ['psf-fwhm', 'PSF ve FWHM'],
    ['kuantum-verimi', 'Kuantum verimi, kazanç ve okuma gürültüsü'],
    ['fits-wcs', 'FITS ve WCS'],
    ['dogrusallik', 'Doygunluk, doğrusallık ve dinamik aralık'],
    ['binning-dithering', 'Binning ve dithering'],
    ['nyquist-shannon', 'Nyquist–Shannon örnekleme kuramı ve örtüşme'],
    ['fourier-fft', 'Fourier dönüşümü ve FFT (sezgisel)'],
    ['konvolusyon', 'Konvolüsyon ve dekonvolüsyon'],
    ['lomb-scargle', 'Lomb–Scargle periyodogramı'],
    ['ki-kare', 'Ki-kare'],
    ['bayes-mcmc', 'Bayes ve MCMC sezgisi'],
  ]],
  ['Matematik araçları', [
    ['poisson-normal', 'Poisson ve normal dağılım: foton sayımı'],
    ['gauss-lorentz-voigt', 'Gauss, Lorentz ve Voigt profilleri'],
    ['bessel', 'Bessel fonksiyonları: Airy diski neden halkalı'],
    ['moffat', 'Moffat profili: yıldız görüntüsünün şekli'],
    ['en-buyuk-olabilirlik', 'En büyük olabilirlik'],
    ['spline', 'Ara değer bulma ve spline'],
    ['runge-kutta', 'Runge–Kutta yöntemi'],
    ['levenberg-marquardt', 'Levenberg–Marquardt: curve_fit\'in içi'],
    ['legendre-kuresel-harmonik', 'Legendre polinomları ve küresel harmonikler (CMB, helyosismoloji)'],
    ['sinc-pencereleme', 'Sinc fonksiyonu ve pencereleme'],
    ['dirac-delta', 'Dirac delta'],
    ['bootstrap', 'Bootstrap'],
    ['pca-svd', 'PCA ve SVD'],
    ['dalgacik', 'Dalgacık (wavelet) dönüşümü'],
  ]],
  ['Gök mekaniği ve zaman', [
    ['lagrange-noktalari', 'Lagrange noktaları ve JWST'],
    ['paralaks-oz-hareket', 'Paralaks, öz hareket ve aberasyon'],
    ['yildiz-zamani', 'Yıldız zamanı'],
    ['julyen-gunu', 'Jülyen günü, UTC, TAI ve artık saniye'],
    ['roche', 'Roche lobu ve Roche sınırı'],
    ['gelgit-kilitlenmesi', 'Gelgit kilitlenmesi'],
    ['vis-viva', 'Vis-viva denklemi'],
    ['hohmann', 'Hohmann transferi'],
    ['hill-kuresi', 'Hill küresi'],
    ['rezonanslar', 'Yörünge rezonansları ve Kirkwood boşlukları'],
    ['presesyon-nutasyon', 'Presesyon ve nütasyon'],
    ['zaman-denklemi', 'Zaman denklemi ve analemma'],
    ['epok', 'Epok (J2000)'],
    ['kozai-lidov', 'Kozai–Lidov etkisi'],
    ['yarkovsky-yorp', 'Yarkovsky ve YORP etkileri'],
  ]],
  ['Işınım ve tayf', [
    ['planck-wien', 'Planck, Wien ve Stefan–Boltzmann yasaları'],
    ['kirchhoff', 'Kirchhoff yasaları'],
    ['optik-derinlik', 'Optik derinlik'],
    ['boltzmann-saha', 'Boltzmann ve Saha denklemleri'],
    ['cizgi-genislemesi', 'Çizgi genişlemesi'],
    ['tayfsal-cozme-gucu', 'Tayfsal çözme gücü'],
    ['21-cm', '21 cm hattı'],
    ['yerel-termodinamik-denge', 'Yerel termodinamik denge'],
    ['zeeman', 'Zeeman etkisi'],
    ['einstein-katsayilari', 'Einstein katsayıları'],
    ['senkrotron', 'Senkrotron ışınımı'],
    ['serbest-serbest', 'Serbest–serbest ışınım'],
    ['compton', 'Compton ve ters Compton saçılması'],
  ]],
  ['Yıldızlar', [
    ['virial', 'Virial teoremi'],
    ['kutle-isinim-gucu', 'Kütle–ışınım gücü ilişkisi'],
    ['sefeid', 'Sefeidlerin periyot–ışınım gücü ilişkisi'],
    ['zaman-olcekleri', 'Yıldızların zaman ölçekleri'],
    ['metallik', 'Metal bolluğu ve yıldız popülasyonları'],
    ['eddington', 'Eddington sınırı'],
    ['chandrasekhar', 'Chandrasekhar sınırı'],
    ['jeans', 'Jeans kütlesi'],
    ['opaklik', 'Opaklık'],
    ['gamow', 'Gamow tepesi'],
    ['nukleosentez', 'Nükleosentez'],
    ['baslangic-kutle-fonksiyonu', 'Başlangıç kütle fonksiyonu'],
    ['tov', 'TOV sınırı'],
    ['magnetar', 'Magnetarlar'],
  ]],
  ['Plazma ve uzay', [
    ['van-allen', 'Van Allen kuşakları'],
    ['parker-sarmali', 'Parker sarmalı'],
    ['manyetik-yeniden-baglanma', 'Manyetik yeniden bağlanma'],
    ['larmor', 'Larmor yarıçapı ve manyetik ayna'],
    ['debye', 'Debye uzunluğu'],
    ['plazma-frekansi', 'Plazma frekansı'],
    ['alfven', 'Alfvén dalgaları'],
    ['landau-sonumu', 'Landau sönümü'],
  ]],
  ['Görelilik, kozmoloji, yüksek enerji', [
    ['schwarzschild', 'Schwarzschild yarıçapı'],
    ['olbers', 'Olbers paradoksu'],
    ['uzaklik-merdiveni', 'Kozmik uzaklık merdiveni'],
    ['karanlik-madde-kanitlari', 'Karanlık madde kanıtları'],
    ['kutlecekim-mercegi', 'Kütleçekim merceği'],
    ['kutlecekimsel-kirmiziya-kayma', 'Kütleçekimsel kırmızıya kayma'],
    ['kutlecekim-dalgasi-olcumu', 'Kütleçekim dalgaları nasıl ölçülür'],
    ['hubble-gerilimi', 'Hubble gerilimi'],
    ['cmb-anizotropi', 'CMB anizotropisi'],
    ['bao', 'Baryon akustik salınımları (BAO)'],
    ['kozmik-enflasyon', 'Kozmik enflasyon'],
    ['hawking', 'Hawking ışıması'],
    ['shapiro', 'Shapiro gecikmesi'],
    ['kilonova', 'Kilonova'],
    ['gelgit-bozulma', 'Gelgit bozulma olayları'],
    ['hizli-radyo-patlamalari', 'Hızlı radyo patlamaları'],
    ['tully-fisher', 'Tully–Fisher ve Faber–Jackson ilişkileri'],
    ['sunyaev-zeldovich', 'Sunyaev–Zel\'dovich etkisi'],
    ['lyman-alfa-ormani', 'Lyman-alfa ormanı'],
    ['kozmik-isinlar', 'Kozmik ışınlar'],
  ]],
  ['Gezegenler ve yaşam', [
    ['yasanabilir-bolge', 'Yaşanabilir bölge'],
    ['gecis-derinligi', 'Geçiş derinliği ve süresi'],
    ['dikine-hiz-genligi', 'Dikine hız yarı genliği'],
    ['kar-cizgisi', 'Kar çizgisi'],
    ['oort-kuiper', 'Oort bulutu ve Kuiper kuşağı'],
    ['albedo-denge-sicakligi', 'Albedo ve denge sıcaklığı'],
    ['sera-etkisi-venus', 'Sera etkisi ve Venüs'],
    ['gelgit-isinmasi', 'Gelgit ısınması'],
    ['drake-fermi', 'Drake denklemi ve Fermi paradoksu'],
    ['zodyak-isigi', 'Zodyak ışığı'],
  ]],
  ['Gözlemevleri ve görevler', [
    ['turkiye-gozlemevleri', 'DAG, TUG ve Türkiye\'deki gözlemevleri'],
    ['turkiye-uzay-programi', 'Türkiye\'nin uzay programı'],
    ['buyuk-gorevler', 'JWST, Hubble, Gaia, Euclid ve Vera Rubin'],
    ['radyo-teleskoplar', 'Radyo teleskoplar ve SKA'],
    ['eht', 'Event Horizon Telescope'],
    ['kutlecekim-dalgasi-gozlemevleri', 'LIGO, Virgo, KAGRA ve LISA'],
    ['kup-uydular', 'Küp uydular'],
  ]],
]

export const CONCEPT_SCOPE = 'Tek derslik kavram dersi: ne olduğu, ne işe yaradığı, astronomide nerede karşına çıktığı, bağlantılı kavramlar. Matematiği "Merak edene" kutusunda.'

const LEVEL_NAMES: Record<Stage3, string> = { temel: 'Temel', orta: 'Orta', ileri: 'İleri' }

export type StageDef = { key: string; series: string; track: Track; level: string; title: string; summary: string; position: number; requires: string }

// Katalogdaki bütün bloklar, hattaki sırasıyla (aralıklı: araya elle blok eklenebilsin)
export function catalogStages(): StageDef[] {
  const stages: StageDef[] = []
  for (const [track, keys] of Object.entries(ORDER) as Array<[Exclude<Track, 'kavram'>, string[]]>) {
    keys.forEach((key, i) => {
      const [seriesKey, level] = key.split('/') as [string, Stage3]
      const series = SERIES.find((s) => s.key === seriesKey)
      const summary = series?.stages[level]
      if (!series || series.track !== track || !summary) throw new Error(`Katalogda tanımsız blok: ${key}`)
      stages.push({ key, series: seriesKey, track, level, title: `${series.title} · ${LEVEL_NAMES[level]}`, summary, position: (i + 1) * 10, requires: (REQUIRES[key] ?? []).join(',') })
    })
  }
  const longest = Math.max(...CONCEPTS.map(([, list]) => list.length))
  let position = 0
  for (let i = 0; i < longest; i++) {
    for (const [, list] of CONCEPTS) {
      if (!list[i]) continue
      const [slug, title] = list[i]
      stages.push({ key: `kavram/${slug}`, series: 'kavramlar', track: 'kavram', level: 'kapsamli', title, summary: '', position: (position += 10), requires: '' })
    }
  }
  return stages
}

// ---- Sıra ----

export type StageState = { key: string; seriesId: number; track: string; level: string; position: number; id: number; requires: string; approved: boolean; planned: boolean; pending: number }

const RANK = ['temel', 'orta', 'ileri']

// Bloğun önkoşulları: serinin önceki aşamaları, seviye tanımı (orta türev ve integral ister, ileri Fourier) ve katalogdakiler
export function requirementsOf(stage: StageState, stages: StageState[]): string[] {
  const rank = RANK.indexOf(stage.level)
  const earlier = stages.filter((s) => s.seriesId === stage.seriesId && RANK.indexOf(s.level) >= 0 && RANK.indexOf(s.level) < rank).map((s) => s.key)
  const math = stage.track === 'astronomi' || stage.track === 'temel' ? ({ orta: ['degisim/orta'], ileri: ['dalgalar/orta'] } as Record<string, string[]>)[stage.level] ?? [] : []
  const own = stage.requires.split(',').map((k) => k.trim()).filter(Boolean)
  return Array.from(new Set([...earlier, ...math, ...own])).filter((key) => key !== stage.key)
}

// Bitmiş blok: derslere bölünmüş ve sırada dersi kalmamış (yazılamayan ders bekletmez; panelden yeniden sıraya alınır)
export const stageDone = (s: StageState) => s.planned && s.pending === 0

// Hattın sıradaki bloğu: önce yarım kalan, sonra sırası gelen ilk hazır blok. Önkoşulu bitmemiş blok atlanır, ama önce
// onu bekleten zincirin başındaki hazır blok yazılır (ör. Yıldızlar · Orta, Isı · Orta'yı öne çeker); önkoşul bitince bloğa dönülür
export function pickStage<T extends StageState>(stages: T[], track: Track): T | null {
  const byKey = new Map(stages.map((s) => [s.key, s]))
  const unmet = (s: T) => requirementsOf(s, stages).map((key) => byKey.get(key)).filter((r): r is T => !!r && !stageDone(r))
  const ready = (s: T) => s.approved && !stageDone(s) && unmet(s).length === 0
  const unlock = (s: T, seen: Set<string>): T | null => {
    for (const r of unmet(s)) {
      if (seen.has(r.key)) continue
      seen.add(r.key)
      const found = ready(r) ? r : unlock(r, seen)
      if (found) return found
    }
    return null
  }
  const own = stages.filter((s) => s.track === track && s.approved && !stageDone(s)).sort((a, b) => a.position - b.position || a.id - b.id)
  const running = own.find((s) => s.planned && ready(s))
  if (running) return running
  for (const s of own) {
    const found = ready(s) ? s : unlock(s, new Set())
    if (found) return found
  }
  return null
}

// Hatların bu dersteki öncelik sırası. history: yazılan müfredat derslerinin hatları, en yenisi önce.
// Uygulama ilk turda her 2 dersten biri, sonra her 4 dersten biri; kalanlar Astronomi → Temel → Astronomi → Temel → Kavram döner
// (içerik büyüklüğüyle orantılı). Sıra haftaya değil ders sayısına bağlı: ders günü sayısı değişince ayar gerekmez
const CYCLE: Track[] = ['astronomi', 'temel', 'astronomi', 'temel', 'kavram']
export function nextTracks(history: string[], firstRoundDone: boolean): Track[] {
  const gap = firstRoundDone ? 4 : 2
  const last = history.indexOf('uygulama')
  const since = last < 0 ? Infinity : last
  const others = history.filter((t) => t !== 'uygulama').length
  const rest = Array.from(new Set(CYCLE.map((_, i) => CYCLE[(others + i) % CYCLE.length])))
  return since >= gap - 1 ? ['uygulama', ...rest] : [...rest, 'uygulama']
}

// ---- Yazım kuralları (yazara ve denetime giden) ----

// Terimler: 600 derste aynı kavrama farklı Türkçe ad verilmesin. İlk geçişte parantezde İngilizcesi
export const TERMS = [
  'akı (flux)', 'ışınım gücü (luminosity; "parlaklık" yalnızca gözle görülen parlaklık için)', 'görünür kadir (apparent magnitude)', 'mutlak kadir (absolute magnitude)',
  'uzaklık modülü (distance modulus)', 'yüzey parlaklığı (surface brightness)', 'renk indisi (color index)', 'bolometrik düzeltme (bolometric correction)',
  'sönümleme (extinction)', 'kızarma (reddening)', 'hava kütlesi (airmass)', 'seeing (ilk geçişte: atmosferik görüntü bozulması)',
  'nokta yayılım fonksiyonu, PSF (point spread function)', 'yarı yükseklikteki tam genişlik, FWHM', 'açıklık fotometrisi (aperture photometry)',
  'diferansiyel fotometri (differential photometry)', 'sinyal-gürültü oranı, S/N', 'okuma gürültüsü (read noise)', 'karanlık akım (dark current)',
  'bias görüntüsü (bias frame)', 'karanlık görüntü (dark frame)', 'düz alan görüntüsü (flat field)', 'kuantum verimi (quantum efficiency)', 'kazanç (gain)',
  'doygunluk (saturation)', 'piksel ölçeği (pixel scale)', 'plaka ölçeği (plate scale)', 'odak uzaklığı (focal length)', 'odak oranı (focal ratio)',
  'açıklık (aperture)', 'açısal çözünürlük (angular resolution)', 'ayırma gücü (resolving power)', 'ışık toplama gücü (light-gathering power)',
  'çıkış pupili (exit pupil)', 'göz merceği (eyepiece)', 'optik sapınç (aberration)', 'renk sapıncı (chromatic aberration)', 'küresel sapınç (spherical aberration)',
  'kırınım (diffraction)', 'girişim (interference)', 'kutuplanma (polarization)', 'dalga cephesi (wavefront)', 'uyarlamalı optik (adaptive optics)',
  'koronagraf (coronagraph)', 'interferometri (interferometry)', 'taban çizgisi (baseline)', 'tayf (spectrum)', 'tayfçeker (spectrograph)',
  'tayfsal çözme gücü (spectral resolving power)', 'dalga boyu kalibrasyonu (wavelength calibration)', 'eşdeğer genişlik (equivalent width)',
  'soğurma çizgisi (absorption line)', 'salma çizgisi (emission line)', 'sürekli tayf (continuum)', 'dikine hız (radial velocity)', 'öz hareket (proper motion)',
  'paralaks (parallax)', 'aberasyon (aberration of starlight; optik sapınçla karıştırma)', 'presesyon (precession)', 'nütasyon (nutation)',
  'yıldız zamanı (sidereal time)', 'Jülyen günü (Julian date)', 'sağ açıklık (right ascension)', 'dik açıklık (declination)', 'saat açısı (hour angle)',
  'yükseklik (altitude)', 'azimut (azimuth)', 'ekliptik (ecliptic)', 'ilkbahar noktası (vernal equinox)', 'gündönümü (solstice)',
  'büyük yarı eksen (semi-major axis)', 'dışmerkezlik (eccentricity)', 'eğiklik (inclination)', 'günberi (perihelion)', 'günöte (aphelion)', 'periyot (period)',
  'kaçış hızı (escape velocity)', 'gelgit (tide)', 'örten çift (eclipsing binary)', 'tayfsal çift (spectroscopic binary)', 'değişen yıldız (variable star)',
  'ışık eğrisi (light curve)', 'geçiş (transit)', 'ötegezegen (exoplanet)', 'anakol (main sequence)', 'dev kolu (giant branch)', 'beyaz cüce (white dwarf)',
  'nötron yıldızı (neutron star)', 'atarca (pulsar)', 'kara delik (black hole)', 'gezegenimsi bulutsu (planetary nebula)', 'yıldızlararası ortam (interstellar medium)',
  'metal bolluğu (metallicity)', 'tayf türü (spectral type)', 'ışınım sınıfı (luminosity class)', 'hidrostatik denge (hydrostatic equilibrium)',
  'durum denklemi (equation of state)', 'opaklık (opacity)', 'ışınım aktarımı (radiative transfer)', 'konveksiyon (convection)', 'optik derinlik (optical depth)',
  'kara cisim (black body)', 'etkin sıcaklık (effective temperature)', 'yerel termodinamik denge (local thermodynamic equilibrium, LTE)',
  'iyonlaşma (ionization)', 'uyarılma (excitation)', 'çizgi genişlemesi (line broadening)', 'senkrotron ışınımı (synchrotron radiation)',
  'serbest–serbest ışınım (bremsstrahlung)', 'kırmızıya kayma (redshift)', 'kozmik mikrodalga arka plan ışınımı (CMB)', 'karanlık madde (dark matter)',
  'karanlık enerji (dark energy)', 'kütleçekim merceklenmesi (gravitational lensing)', 'kütleçekim dalgası (gravitational wave)', 'olay ufku (event horizon)',
  'birikim diski (accretion disk)', 'etkin galaksi çekirdeği (active galactic nucleus, AGN)', 'dönme eğrisi (rotation curve)', 'korona (corona)',
  'koronal kütle atımı (coronal mass ejection)', 'güneş rüzgârı (solar wind)', 'uzay havası (space weather)', 'füzyon (nuclear fusion)',
  'görüntü (frame)', 'istifleme (stacking)', 'hizalama (registration)', 'kaynak bulma (source detection)', 'eşikleme (thresholding)', 'konvolüsyon (convolution)',
  'dekonvolüsyon (deconvolution)', 'Fourier dönüşümü (Fourier transform)', 'örnekleme (sampling)', 'örtüşme (aliasing)', 'periyodogram (periodogram)',
  'en küçük kareler (least squares)', 'olabilirlik (likelihood)', 'önsel dağılım (prior)', 'sonsal dağılım (posterior)', 'belirsizlik (uncertainty)',
  'sistematik hata (systematic error)', 'hata yayılımı (error propagation)', 'binning (piksel birleştirme)', 'dithering (kaydırmalı poz)',
]

export const NOTATION = [
  'Birimler SI; astronomide yerleşik birimler de kullanılır: astronomik birim (AB), parsek (pc), ışık yılı, Güneş kütlesi $M_\\odot$, Güneş ışınım gücü $L_\\odot$, yay saniyesi (″), jansky (Jy), nm ve Å.',
  'Ondalık ayırıcı metinde ve formüllerde virgül ($1{,}22$), kodda nokta.',
  'Semboller: dalga boyu $\\lambda$, frekans $\\nu$, açıklık çapı $D$, odak uzaklığı $f$, akı $F$, ışınım gücü $L$, görünür kadir $m$, mutlak kadir $M$ (kütleyle karışacaksa kütle $\\mathcal{M}$), etkin sıcaklık $T_{\\rm eff}$, kırmızıya kayma $z$, Hubble sabiti $H_0$.',
  'Kod Python 3; kodun sonunda bir yorum satırında hangi kütüphane sürümleriyle yazıldığı (araştırma notlarındaki güncel sürümler).',
]

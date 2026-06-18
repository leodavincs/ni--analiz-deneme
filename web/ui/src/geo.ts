// Coğrafi sözlük — RSS haberlerini ülkelere bağlamak için.
// Veride coğrafi alan yok; başlık + özetten anahtar kelimeyle ülke tespit edilir.
// Eşleşmeyen haber kürede gösterilmez (gürültü yerine boşluk yeğ).

export type Country = {
  name: string; // Türkçe ülke adı (kart altyazısı)
  flag: string; // bayrak emoji
  lat: number; // merkez/başkent enlem
  lng: number; // merkez/başkent boylam
};

// Büyük ülkeler için sınır içi dağılım noktaları (yaklaşık şehir koordinatları).
const SPREAD: Record<string, [number, number][]> = {
  US: [
    [40.71, -74.01], // New York
    [37.77, -122.42], // San Francisco
    [34.05, -118.24], // Los Angeles
    [41.88, -87.63], // Chicago
    [47.61, -122.33], // Seattle
    [30.27, -97.74], // Austin
    [42.36, -71.06], // Boston
    [25.76, -80.19], // Miami
    [39.74, -104.99], // Denver
    [33.75, -84.39], // Atlanta
    [38.9, -77.04], // Washington DC
    [44.98, -93.27], // Minneapolis
  ],
  CA: [
    [43.65, -79.38], // Toronto
    [49.28, -123.12], // Vancouver
    [45.5, -73.57], // Montreal
    [51.05, -114.07], // Calgary
    [45.42, -75.7], // Ottawa
  ],
  BR: [
    [-23.55, -46.63], // São Paulo
    [-22.91, -43.17], // Rio
    [-15.79, -47.88], // Brasília
    [-19.92, -43.94], // Belo Horizonte
  ],
  CN: [
    [39.9, 116.4], // Beijing
    [31.23, 121.47], // Shanghai
    [22.54, 114.06], // Shenzhen
    [30.27, 120.15], // Hangzhou
    [30.57, 104.07], // Chengdu
  ],
  IN: [
    [19.08, 72.88], // Mumbai
    [12.97, 77.59], // Bengaluru
    [28.61, 77.21], // New Delhi
    [17.39, 78.49], // Hyderabad
    [13.08, 80.27], // Chennai
  ],
  AU: [
    [-33.87, 151.21], // Sydney
    [-37.81, 144.96], // Melbourne
    [-27.47, 153.03], // Brisbane
    [-31.95, 115.86], // Perth
  ],
  RU: [
    [55.75, 37.62], // Moscow
    [59.93, 30.34], // St Petersburg
    [55.01, 82.93], // Novosibirsk
  ],
  DE: [
    [52.52, 13.4], // Berlin
    [48.14, 11.58], // Munich
    [53.55, 9.99], // Hamburg
    [50.11, 8.68], // Frankfurt
  ],
  GB: [
    [51.51, -0.12], // London
    [53.48, -2.24], // Manchester
    [55.95, -3.19], // Edinburgh
    [52.2, 0.12], // Cambridge
  ],
};

// ~40 ülke — başkent/merkez koordinatlarıyla. Genişletmesi kolay düz veri.
export const COUNTRIES: Record<string, Country> = {
  US: { name: "ABD", flag: "🇺🇸", lat: 38.9, lng: -77.0 },
  GB: { name: "Birleşik Krallık", flag: "🇬🇧", lat: 51.5, lng: -0.12 },
  CA: { name: "Kanada", flag: "🇨🇦", lat: 45.4, lng: -75.7 },
  BR: { name: "Brezilya", flag: "🇧🇷", lat: -15.8, lng: -47.9 },
  MX: { name: "Meksika", flag: "🇲🇽", lat: 19.4, lng: -99.1 },
  AR: { name: "Arjantin", flag: "🇦🇷", lat: -34.6, lng: -58.4 },
  DE: { name: "Almanya", flag: "🇩🇪", lat: 52.5, lng: 13.4 },
  FR: { name: "Fransa", flag: "🇫🇷", lat: 48.85, lng: 2.35 },
  ES: { name: "İspanya", flag: "🇪🇸", lat: 40.4, lng: -3.7 },
  IT: { name: "İtalya", flag: "🇮🇹", lat: 41.9, lng: 12.5 },
  NL: { name: "Hollanda", flag: "🇳🇱", lat: 52.37, lng: 4.9 },
  SE: { name: "İsveç", flag: "🇸🇪", lat: 59.33, lng: 18.07 },
  CH: { name: "İsviçre", flag: "🇨🇭", lat: 46.95, lng: 7.45 },
  IE: { name: "İrlanda", flag: "🇮🇪", lat: 53.35, lng: -6.26 },
  PL: { name: "Polonya", flag: "🇵🇱", lat: 52.23, lng: 21.0 },
  UA: { name: "Ukrayna", flag: "🇺🇦", lat: 50.45, lng: 30.5 },
  RU: { name: "Rusya", flag: "🇷🇺", lat: 55.75, lng: 37.6 },
  TR: { name: "Türkiye", flag: "🇹🇷", lat: 39.93, lng: 32.86 },
  IL: { name: "İsrail", flag: "🇮🇱", lat: 32.07, lng: 34.78 },
  AE: { name: "BAE", flag: "🇦🇪", lat: 25.2, lng: 55.27 },
  SA: { name: "Suudi Arabistan", flag: "🇸🇦", lat: 24.71, lng: 46.68 },
  IN: { name: "Hindistan", flag: "🇮🇳", lat: 28.61, lng: 77.21 },
  CN: { name: "Çin", flag: "🇨🇳", lat: 39.9, lng: 116.4 },
  JP: { name: "Japonya", flag: "🇯🇵", lat: 35.68, lng: 139.69 },
  KR: { name: "Güney Kore", flag: "🇰🇷", lat: 37.57, lng: 126.98 },
  SG: { name: "Singapur", flag: "🇸🇬", lat: 1.35, lng: 103.82 },
  ID: { name: "Endonezya", flag: "🇮🇩", lat: -6.2, lng: 106.85 },
  PH: { name: "Filipinler", flag: "🇵🇭", lat: 14.6, lng: 120.98 },
  VN: { name: "Vietnam", flag: "🇻🇳", lat: 21.03, lng: 105.85 },
  TH: { name: "Tayland", flag: "🇹🇭", lat: 13.75, lng: 100.5 },
  PK: { name: "Pakistan", flag: "🇵🇰", lat: 33.69, lng: 73.06 },
  BD: { name: "Bangladeş", flag: "🇧🇩", lat: 23.81, lng: 90.41 },
  HK: { name: "Hong Kong", flag: "🇭🇰", lat: 22.32, lng: 114.17 },
  TW: { name: "Tayvan", flag: "🇹🇼", lat: 25.03, lng: 121.57 },
  AU: { name: "Avustralya", flag: "🇦🇺", lat: -33.87, lng: 151.21 },
  NZ: { name: "Yeni Zelanda", flag: "🇳🇿", lat: -41.29, lng: 174.78 },
  NG: { name: "Nijerya", flag: "🇳🇬", lat: 6.52, lng: 3.38 },
  KE: { name: "Kenya", flag: "🇰🇪", lat: -1.29, lng: 36.82 },
  ZA: { name: "Güney Afrika", flag: "🇿🇦", lat: -26.2, lng: 28.04 },
  EG: { name: "Mısır", flag: "🇪🇬", lat: 30.04, lng: 31.24 },
  GH: { name: "Gana", flag: "🇬🇭", lat: 5.6, lng: -0.19 },
  MY: { name: "Malezya", flag: "🇲🇾", lat: 3.14, lng: 101.69 },
  CL: { name: "Şili", flag: "🇨🇱", lat: -33.45, lng: -70.67 },
  CO: { name: "Kolombiya", flag: "🇨🇴", lat: 4.71, lng: -74.07 },
  PE: { name: "Peru", flag: "🇵🇪", lat: -12.05, lng: -77.04 },
  PT: { name: "Portekiz", flag: "🇵🇹", lat: 38.72, lng: -9.14 },
  BE: { name: "Belçika", flag: "🇧🇪", lat: 50.85, lng: 4.35 },
  AT: { name: "Avusturya", flag: "🇦🇹", lat: 48.21, lng: 16.37 },
  DK: { name: "Danimarka", flag: "🇩🇰", lat: 55.68, lng: 12.57 },
  NO: { name: "Norveç", flag: "🇳🇴", lat: 59.91, lng: 10.75 },
  FI: { name: "Finlandiya", flag: "🇫🇮", lat: 60.17, lng: 24.94 },
  GR: { name: "Yunanistan", flag: "🇬🇷", lat: 37.98, lng: 23.73 },
  CZ: { name: "Çekya", flag: "🇨🇿", lat: 50.08, lng: 14.44 },
  RO: { name: "Romanya", flag: "🇷🇴", lat: 44.43, lng: 26.1 },
  HU: { name: "Macaristan", flag: "🇭🇺", lat: 47.5, lng: 19.04 },
  EE: { name: "Estonya", flag: "🇪🇪", lat: 59.44, lng: 24.75 },
  QA: { name: "Katar", flag: "🇶🇦", lat: 25.29, lng: 51.53 },
  MA: { name: "Fas", flag: "🇲🇦", lat: 33.97, lng: -6.85 },
  ET: { name: "Etiyopya", flag: "🇪🇹", lat: 9.03, lng: 38.74 },
  SN: { name: "Senegal", flag: "🇸🇳", lat: 14.69, lng: -17.45 },
};

// Eşleme kuralları — SIRA ÖNEMLİ: ilk eşleşen kazanır.
// Önce belirgin şehir/şirket (daha spesifik), sonra ülke/demonym adları.
// Kelime-sınırlı (\b) yanlış pozitifi azaltır.
type Rule = { re: RegExp; cc: string };

function rule(pattern: string, cc: string): Rule {
  return { re: new RegExp(`\\b(?:${pattern})\\b`, "i"), cc };
}

export const KEYWORDS: Rule[] = [
  // --- Belirgin şirket → merkez ülke (spesifik, önce gelsin) ---
  rule("openai|anthropic|google|alphabet|apple|meta|facebook|instagram|whatsapp|microsoft|amazon|aws|nvidia|tesla|spacex|starlink|netflix|disney|uber|lyft|airbnb|doordash|instacart|stripe|coinbase|robinhood|salesforce|oracle|intel|amd|broadcom|ibm|qualcomm|dell|hp inc|paypal|figma|reddit|snapchat|snap inc|pinterest|adobe|cisco|x corp|twitter|perplexity|scale ai|databricks|snowflake|palantir|twilio|zoom|slack|dropbox|github|gitlab|hashicorp|mongodb|cloudflare|vercel|notion|airtable|miro|discord|roblox|epic games|electronic arts|activision|unity technologies|anduril|waymo|cruise|plaid|brex|ramp|chime|affirm|block inc|square inc", "US"),
  rule("deepseek|alibaba|tencent|bytedance|tiktok|baidu|huawei|xiaomi|byd|nio|xpeng|li auto|temu|shein|ant group|didi|meituan|jd\\.com|pinduoduo|kuaishou|sensetime|zhipu|moonshot|minimax|01\\.ai|unitree", "CN"),
  rule("mistral|datadog|criteo|qonto|doctolib|back market|contentsquare|dataiku|ledger|alan|sorare|swile|veepee|ovhcloud", "FR"),
  rule("spotify|klarna|ericsson|mojang|northvolt|truecaller|sinch|epidemic sound|voi", "SE"),
  rule("sap|deepl|delivery hero|n26|celonis|personio|trade republic|zalando|hellofresh|gorillas|wefox|aleph alpha", "DE"),
  rule("samsung|lg electronics|naver|kakao|coupang|hyundai|sk hynix|krafton|nexon|toss", "KR"),
  rule("sony|nintendo|softbank|toyota|rakuten|honda|mercari|line corp|sega|panasonic|nissan", "JP"),
  rule("tsmc|foxconn|mediatek|acer|asus|htc", "TW"),
  rule("grab|sea limited|shopee|garena|razer|ninja van|carousell|patsnap", "SG"),
  rule("gojek|tokopedia|bukalapak|traveloka|blibli|goto group", "ID"),
  rule("paytm|flipkart|zomato|swiggy|infosys|tata|reliance|wipro|byju|razorpay|cred|meesho|dream11|phonepe|freshworks|zoho|postman|ola electric|ola cabs|nykaa|groww|zerodha|hcl", "IN"),
  rule("nubank|mercado libre|mercadolibre|ifood|stone co|quintoandar|loft|wildlife studios|ebanx|nuvei", "BR"),
  rule("kavak|bitso|konfio|clip", "MX"),
  rule("rappi", "CO"),
  rule("flutterwave|paystack|andela|interswitch|opay|kuda|moniepoint", "NG"),
  rule("safaricom|m-pesa|mpesa", "KE"),
  rule("wave mobile", "SN"),
  rule("revolut|deepmind|arm holdings|wise|monzo|darktrace|wayve|synthesia|stability ai|graphcore|deliveroo|starling bank|checkout\\.com|babylon health|improbable|ocado", "GB"),
  rule("shopify|nortel|blackberry|cohere|lightspeed|hootsuite|wealthsimple|clearco|1password", "CA"),
  rule("atlassian|canva|afterpay|airwallex|safetyculture|culture amp|immutable", "AU"),
  rule("asml|adyen|booking\\.com|philips|mollie|messagebird|picnic|takeaway", "NL"),
  rule("nestle|ubs|logitech|novartis|roche|on running|scandit", "CH"),
  rule("wiz|monday\\.com|fiverr|lemonade|payoneer|mobileye|check point|wix|jfrog|cybereason|melio|riskified", "IL"),
  rule("bolt technology|skype|pipedrive", "EE"),

  // --- Büyük şehirler / bölgeler ---
  rule("silicon valley|san francisco|bay area|new york|nyc|brooklyn|los angeles|seattle|boston|austin|washington dc|chicago|miami|atlanta|denver|dallas|houston|san diego|palo alto|menlo park|cupertino|mountain view|redmond|wall street|hollywood", "US"),
  rule("london|manchester|cambridge|oxford|edinburgh|bristol|leeds", "GB"),
  rule("toronto|vancouver|montreal|ottawa|calgary|waterloo", "CA"),
  rule("paris|lyon|marseille|toulouse", "FR"),
  rule("berlin|munich|münchen|hamburg|frankfurt|cologne|köln", "DE"),
  rule("madrid|barcelona|valencia", "ES"),
  rule("rome|milan|milano|turin|torino", "IT"),
  rule("amsterdam|rotterdam|eindhoven|the hague", "NL"),
  rule("stockholm|gothenburg", "SE"),
  rule("zurich|zürich|geneva|cenevre|basel", "CH"),
  rule("dublin", "IE"),
  rule("warsaw|varşova|krakow|kraków", "PL"),
  rule("kyiv|kiev|lviv", "UA"),
  rule("moscow|moskova|st petersburg", "RU"),
  rule("istanbul|i̇stanbul|ankara|izmir|i̇zmir", "TR"),
  rule("tel aviv|jerusalem|kudüs|haifa", "IL"),
  rule("dubai|abu dhabi", "AE"),
  rule("riyadh|riyad|jeddah|neom", "SA"),
  rule("doha", "QA"),
  rule("mumbai|bengaluru|bangalore|new delhi|delhi|hyderabad|chennai|pune|kolkata|gurugram|gurgaon|noida|ahmedabad", "IN"),
  rule("beijing|pekin|shanghai|shenzhen|guangzhou|hangzhou|chengdu|wuhan", "CN"),
  rule("tokyo|tokio|osaka|kyoto|yokohama", "JP"),
  rule("seoul|seul|busan", "KR"),
  rule("hong kong", "HK"),
  rule("taipei|taipeh|hsinchu", "TW"),
  rule("jakarta|cakarta|bandung", "ID"),
  rule("manila|cebu", "PH"),
  rule("hanoi|ho chi minh|saigon", "VN"),
  rule("bangkok|chiang mai", "TH"),
  rule("kuala lumpur|penang", "MY"),
  rule("karachi|lahore|islamabad", "PK"),
  rule("dhaka|dakka", "BD"),
  rule("sydney|melbourne|canberra|brisbane|perth", "AU"),
  rule("auckland|wellington", "NZ"),
  rule("lagos|abuja|lekki", "NG"),
  rule("nairobi|mombasa", "KE"),
  rule("johannesburg|cape town|capetown|pretoria|durban", "ZA"),
  rule("cairo|kahire|alexandria", "EG"),
  rule("accra", "GH"),
  rule("casablanca|rabat|marrakech", "MA"),
  rule("addis ababa", "ET"),
  rule("dakar", "SN"),
  rule("lisbon|lisboa|porto", "PT"),
  rule("brussels|antwerp", "BE"),
  rule("vienna|wien", "AT"),
  rule("copenhagen|kopenhag", "DK"),
  rule("oslo", "NO"),
  rule("helsinki", "FI"),
  rule("athens|atina|thessaloniki", "GR"),
  rule("prague|prag", "CZ"),
  rule("bucharest|bükreş", "RO"),
  rule("budapest|budapeşte", "HU"),
  rule("tallinn", "EE"),
  rule("mexico city|guadalajara|monterrey", "MX"),
  rule("buenos aires|córdoba", "AR"),
  rule("são paulo|sao paulo|rio de janeiro|brasilia|brasília|belo horizonte", "BR"),
  rule("santiago", "CL"),
  rule("bogota|bogotá|medellin|medellín", "CO"),
  rule("lima", "PE"),

  // --- Ülke / demonym adları (en genel, en sonda) ---
  rule("u\\.?s\\.?a?|america|americans?|united states", "US"),
  rule("u\\.?k\\.?|britain|british|england|english|scotland|scottish|wales|welsh", "GB"),
  rule("canada|canadian", "CA"),
  rule("brazil|brazilian|brasil", "BR"),
  rule("mexico|mexican", "MX"),
  rule("argentina|argentine|argentinian", "AR"),
  rule("germany|germans?|deutschland", "DE"),
  rule("france|french", "FR"),
  rule("spain|spanish", "ES"),
  rule("italy|italian", "IT"),
  rule("netherlands|dutch|holland", "NL"),
  rule("sweden|swedish", "SE"),
  rule("switzerland|swiss", "CH"),
  rule("ireland|irish", "IE"),
  rule("poland|polish", "PL"),
  rule("ukraine|ukrainian", "UA"),
  rule("russia|russian", "RU"),
  rule("turkey|türkiye|turkish|turkiye", "TR"),
  rule("israel|israeli", "IL"),
  rule("emirates|uae", "AE"),
  rule("saudi|saudi arabia", "SA"),
  rule("qatar|qatari", "QA"),
  rule("india|indian", "IN"),
  rule("china|chinese", "CN"),
  rule("japan|japanese", "JP"),
  rule("korea|korean|south korea", "KR"),
  rule("singapore|singaporean", "SG"),
  rule("indonesia|indonesian", "ID"),
  rule("malaysia|malaysian", "MY"),
  rule("philippines|filipino", "PH"),
  rule("vietnam|vietnamese", "VN"),
  rule("thailand|thai", "TH"),
  rule("pakistan|pakistani", "PK"),
  rule("bangladesh|bangladeshi", "BD"),
  rule("taiwan|taiwanese", "TW"),
  rule("australia|australian", "AU"),
  rule("new zealand", "NZ"),
  rule("nigeria|nigerian", "NG"),
  rule("kenya|kenyan", "KE"),
  rule("south africa|south african", "ZA"),
  rule("egypt|egyptian", "EG"),
  rule("ghana|ghanaian", "GH"),
  rule("morocco|moroccan", "MA"),
  rule("ethiopia|ethiopian", "ET"),
  rule("senegal|senegalese", "SN"),
  rule("portugal|portuguese", "PT"),
  rule("belgium|belgian", "BE"),
  rule("austria|austrian", "AT"),
  rule("denmark|danish", "DK"),
  rule("norway|norwegian", "NO"),
  rule("finland|finnish", "FI"),
  rule("greece|greek", "GR"),
  rule("czech|czechia", "CZ"),
  rule("romania|romanian", "RO"),
  rule("hungary|hungarian", "HU"),
  rule("estonia|estonian", "EE"),
  rule("chile|chilean", "CL"),
  rule("colombia|colombian", "CO"),
  rule("peru|peruvian", "PE"),
];

// Başlık + özetten ilk eşleşen ülke kodunu döndürür; eşleşme yoksa null.
export function detectCountry(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const { re, cc } of KEYWORDS) {
    if (re.test(text)) return cc;
  }
  return null;
}

// Merkez çevresinde deterministik altın-açı jitter (sınır içinde küçük kayma).
function jitter(
  [lat, lng]: [number, number],
  k: number,
): [number, number] {
  const ang = k * 2.399963; // altın açı (rad) → eşit dağılır
  const r = 0.7 + 0.45 * k; // derece — küçük tut ki sınır içinde kalsın
  const lngScale = Math.max(0.3, Math.cos((lat * Math.PI) / 180));
  return [lat + r * Math.sin(ang), lng + (r * Math.cos(ang)) / lngScale];
}

// Bir ülkedeki i. haberin yaklaşık konumu — kartlar sınır içinde dağıtılır.
// Büyük ülkelerde gerçek iç şehirler kullanılır; diğerlerinde merkez + jitter.
export function spreadLocation(cc: string, index: number): [number, number] {
  const c = COUNTRIES[cc];
  if (!c) return [0, 0];
  const pts = SPREAD[cc];
  if (pts) {
    if (index < pts.length) return pts[index];
    // şehirler bittiyse: o şehirler çevresinde küçük jitter
    return jitter(pts[index % pts.length], Math.floor(index / pts.length) + 1);
  }
  if (index === 0) return [c.lat, c.lng]; // ilk haber tam merkezde
  return jitter([c.lat, c.lng], index);
}

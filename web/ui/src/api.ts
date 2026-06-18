// Tek fetch helper — tüm panel verisi /api/* üzerinden gelir (salt-okunur).

export type Overview = {
  signals_total: number;
  trend_items_total: number;
  niches_total: number;
  trends_total: number;
  niches_git: number;
  trends_aksiyon: number;
  last_scan_signals: string | null;
  last_scan_trends: string | null;
  sources: { source: string; n: number }[];
  domains: { domain: string; n: number }[];
};

export type Niche = {
  slug: string;
  title: string;
  status: "git" | "bekle" | "aday" | "ele";
  yatkinlik: number;
  problem: number;
  para_akisi: number;
  total: number;
  summary: string | null;
  updated_at: string | null;
  // Obsidian notundan zenginleştirilen alanlar (kart için; opsiyonel)
  why?: string; // kök problem — "neden bu niş"
  kime?: string; // ICP
  aci?: string; // hangi acı
  model?: string; // kurulabilir kama / iş modeli
  mvp?: string; // ≤1 cümle ilk çıktı
};

export type Trend = {
  slug: string;
  title: string;
  domain: string | null;
  momentum: number;
  tr_uygunluk: number;
  firsat: number;
  total: number;
  status: "aksiyon" | "izle" | "gec";
  entegrasyon: string | null;
  turkiye_fikri: string | null;
  updated_at: string | null;
};

export type Opportunity = {
  opportunity_id: string;
  title: string;
  score: number | null;
  score_max: number;
  confidence: "high" | "med" | "low" | null;
  opportunity_type: string | null;
  cluster: string | null;
  status: string | null;
  date: string;
  tags: string[];
  sources: string[];
  why_now?: string;
  icp?: string;
  wedge?: string;
  first_output?: string;
  tr_angle?: string;
  monetization?: string;
  risk?: string;
  score_line?: string;
};

export type Settings = {
  limits: {
    signal_threshold: number;
    max_items_per_source: number;
    analysis_max_items: number;
    trend_analysis_max_items: number;
    max_items_per_feed: number;
  };
  obsidian_vault: string | null;
  reddit: {
    enabled: boolean;
    actor: string | null;
    sort: string | null;
    time_filter: string | null;
    max_items: number | null;
    max_wait: number | null;
    subreddits: string[];
    token_set: boolean;
  };
  hackernews: {
    enabled: boolean;
    queries: string[];
    min_points: number | null;
    days_back: number | null;
  };
  producthunt_enabled: boolean;
  rss: {
    enabled: boolean;
    feeds: { name: string; domain: string; url: string }[];
    google_news: { domain: string; q: string }[];
  };
  cadence: Record<string, string | number>;
  status: {
    last_trend_scan: string | null;
    last_signal_scan: string | null;
    collector: CollectorState;
  };
};

export type NoteSection = { heading: string; lines: string[] };
export type NoteDetail = {
  kind: string;
  slug: string;
  title: string | null;
  meta: Record<string, unknown>;
  sections: NoteSection[];
};

export type FeedItem = {
  title: string | null;
  source: string;
  signal_score?: number;
  domain?: string;
  url: string | null;
  collected_at: string;
};

export type NewsItem = {
  id: number;
  source: string;
  title: string | null;
  summary: string | null;
  domain: string | null;
  url: string | null;
  published_at: string | null;
  published_ts: string | null;
  collected_at: string;
};

export type CollectorState = {
  running: boolean;
  started_at: string | null;
  finished_at: string | null;
  last_added: number;
  last_fetched: number;
  session_added: number;
  runs: number;
  error: string | null;
};

export type NewsResponse = {
  items: NewsItem[];
  counts: { domain: string; n: number }[];
  source_counts: { source: string; n: number }[];
  total: number;
  collector: CollectorState;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  overview: () => get<Overview>("/api/overview"),
  niches: () => get<Niche[]>("/api/niches"),
  trends: () => get<Trend[]>("/api/trends"),
  opportunities: () =>
    get<{ items: Opportunity[]; total: number }>("/api/opportunities"),
  note: (kind: string, slug: string) =>
    get<NoteDetail>(`/api/note?kind=${kind}&slug=${encodeURIComponent(slug)}`),
  settings: () => get<Settings>("/api/settings"),
  feed: (limit = 40) => get<FeedItem[]>(`/api/feed?limit=${limit}`),
  news: (domain = "all", limit = 60, sources?: string[]) => {
    let url = `/api/news?domain=${encodeURIComponent(domain)}&limit=${limit}`;
    // sources verildiyse (boş dizi dahil) parametreyi ekle → boş = "hiçbiri".
    if (sources !== undefined)
      url += `&sources=${sources.map(encodeURIComponent).join(",")}`;
    return get<NewsResponse>(url);
  },
  collectRss: () =>
    post<{ started: boolean; collector: CollectorState }>("/api/collect/rss"),
  earlyAccess: (email: string) =>
    post<{ ok: boolean; error?: string }>("/api/early-access", { email }),
};

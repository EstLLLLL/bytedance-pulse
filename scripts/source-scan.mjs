const QUERY_SPECS = [
  ["字节跳动 全员会 内部信 梁汝波 张一鸣", "zh"],
  ["抖音电商 GMV 增速 目标 订单 客单价 商城 货架", "zh"],
  ["抖音 本地生活 GTV 补贴 商家 留存 利润", "zh"],
  ["飞书 Lark 并入 整合 汇报线 ARR 客户 席位", "zh"],
  ["豆包 DAU MAU 收入 Token 调用量 付费", "zh"],
  ["火山引擎 收入 客户 价格 算力 毛利", "zh"],
  ["字节跳动 回购 估值 ESOP IPO 融资 股权", "zh"],
  ["字节跳动 CapEx 芯片 数据中心 Nvidia 算力", "zh"],
  ["红果 番茄 剪映 CapCut PICO 即梦 扣子 字节", "zh"],
  ["抖音 直播 广告 收入 利润率 变现", "zh"],
  ["ByteDance all hands internal memo Liang Rubo Zhang Yiming", "en"],
  ["TikTok Shop GMV orders sellers subsidy commission fulfillment", "en"],
  ["ByteDance valuation buyback ESOP IPO secondary shares", "en"],
  ["ByteDance AI capex chips Nvidia data center", "en"],
  ["Doubao users revenue tokens Volcano Engine customers", "en"],
  ["Feishu Lark ARR customers restructuring Doubao", "en"],
  ["TikTok USDS regulation lawsuit EU DSA ban", "en"],
  ["CapCut ByteDance revenue users regulation", "en"],
  ["site:theinformation.com ByteDance TikTok Doubao Seed", "en"],
  ["site:bloomberg.com OR site:reuters.com OR site:finance.yahoo.com ByteDance TikTok", "en"],
];

const DIRECT_PAGES = [
  ["The Information · Latest", "https://www.theinformation.com/?view=recent"],
  ["The Information · Most Popular", "https://www.theinformation.com/?view=popular"],
  ["The Information · The Briefing", "https://www.theinformation.com/features/the-briefing"],
  ["Bloomberg · Technology", "https://www.bloomberg.com/technology"],
  ["Bloomberg · Markets", "https://www.bloomberg.com/markets"],
  ["Reuters · Technology", "https://www.reuters.com/technology/"],
  ["Reuters · Business", "https://www.reuters.com/business/"],
  ["Reuters · World", "https://www.reuters.com/world/"],
  ["Yahoo Finance · News", "https://finance.yahoo.com/news/"],
  ["Yahoo Tech", "https://tech.yahoo.com/"],
  ["36氪 · 最新", "https://www.36kr.com/information/web_news/latest/"],
  ["虎嗅 · 资讯", "https://www.huxiu.com/moment/"],
  ["界面 · 科技", "https://www.jiemian.com/lists/280.html"],
  ["第一财经 · 新闻", "https://www.yicai.com/news/"],
  ["新浪科技", "https://finance.sina.com.cn/tech/"],
  ["澎湃 · 科技", "https://www.thepaper.cn/channel_25950"],
  ["ByteDance · News", "https://www.bytedance.com/en/news"],
  ["TikTok · Newsroom", "https://newsroom.tiktok.com/"],
  ["ByteDance Seed · Blog", "https://seed.bytedance.com/zh/blog"],
  ["EU Digital Strategy · News", "https://digital-strategy.ec.europa.eu/en/news"],
  ["中央网信办", "https://www.cac.gov.cn/"],
];

const NAMED_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
  nbsp: " ",
};

function decodeEntities(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name] ?? match);
}

function cleanText(value = "") {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return cleanText(match?.[1] ?? "");
}

function parseRss(xml, query) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .slice(0, 10)
    .map(([, block], index) => {
      const sourceMatch = block.match(/<source\b[^>]*url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i);
      return {
        kind: "search-result",
        query,
        position: index + 1,
        title: extractTag(block, "title"),
        url: extractTag(block, "link"),
        publishedAt: extractTag(block, "pubDate"),
        source: cleanText(sourceMatch?.[2] ?? "Google News"),
        sourceHomepage: decodeEntities(sourceMatch?.[1] ?? ""),
        snippet: extractTag(block, "description").slice(0, 1400),
      };
    })
    .filter((item) => item.title && item.url);
}

function parseDuckDuckGo(html, query) {
  const results = [];
  const pattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    if (results.length >= 10) break;
    let url = decodeEntities(match[1]);
    try {
      const redirect = new URL(url, "https://html.duckduckgo.com");
      url = redirect.searchParams.get("uddg") ?? redirect.href;
    } catch {}
    results.push({
      kind: "search-result",
      query,
      position: results.length + 1,
      title: cleanText(match[2]),
      url,
      publishedAt: "",
      source: "DuckDuckGo",
      sourceHomepage: "",
      snippet: "",
    });
  }
  return results;
}

async function fetchText(url, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { text: await response.text(), finalUrl: response.url };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
}

async function scanQuery([query, language]) {
  const locale =
    language === "zh"
      ? "hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans"
      : "hl=en-US&gl=US&ceid=US%3Aen";
  const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;
  try {
    const { text } = await fetchText(googleUrl);
    const documents = parseRss(text, query);
    if (documents.length) return { query, status: "ok", engine: "Google News RSS", documents };
  } catch {}

  const duckUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const { text } = await fetchText(duckUrl);
    const documents = parseDuckDuckGo(text, query);
    if (documents.length) return { query, status: "ok", engine: "DuckDuckGo HTML", documents };
  } catch {}

  return { query, status: "failed", engine: "none", documents: [] };
}

async function scanDirectPage([label, url]) {
  try {
    const { text, finalUrl } = await fetchText(url);
    return {
      label,
      status: "ok",
      document: {
        kind: "editorial-page",
        query: label,
        position: 0,
        title: label,
        url: finalUrl,
        publishedAt: "",
        source: label,
        sourceHomepage: url,
        snippet: cleanText(text).slice(0, 9000),
      },
    };
  } catch (error) {
    return { label, status: `failed: ${error.message}`, document: null };
  }
}

async function runPool(items, worker, concurrency = 5) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

export async function collectPublicSources() {
  const [queryRuns, pageRuns] = await Promise.all([
    runPool(QUERY_SPECS, scanQuery, 5),
    runPool(DIRECT_PAGES, scanDirectPage, 5),
  ]);

  const documents = [
    ...queryRuns.flatMap((run) => run.documents),
    ...pageRuns.map((run) => run.document).filter(Boolean),
  ];
  const seen = new Set();
  const deduped = documents.filter((document) => {
    const key = `${document.title.toLowerCase()}|${document.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    scannedAt: new Date().toISOString(),
    coverage: {
      queries: queryRuns.map(({ query, status, engine, documents: rows }) => ({
        query,
        status,
        engine,
        results: rows.length,
      })),
      editorialPages: pageRuns.map(({ label, status }) => ({ label, status })),
    },
    documents: deduped.slice(0, 220),
  };
}

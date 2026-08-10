import { readFile, writeFile } from "node:fs/promises";
import { collectPublicSources } from "./source-scan.mjs";

const apiKey = process.env.ARK_API_KEY;
const model = process.env.ARK_MODEL;
if (!apiKey || !model) {
  throw new Error(
    "ARK_API_KEY or ARK_MODEL is missing. Add both as GitHub Actions repository secrets before running the daily monitor.",
  );
}

const now = new Date();
const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .filter(({ type }) => type !== "literal")
    .map(({ type, value }) => [type, value]),
);
const date = `${parts.year}-${parts.month}-${parts.day}`;
const displayDate = `${parts.month} / ${parts.day}`;
const verifiedAt = `北京时间 ${date} ${parts.hour}:${parts.minute}`;

const reportsUrl = new URL("../data/reports.json", import.meta.url);
const reports = JSON.parse(await readFile(reportsUrl, "utf8"));
const existingToday = reports.find((item) => item.date === date) ?? null;
const previous = reports.find((item) => item.date !== date) ?? null;
const sourceBundle = await collectPublicSources();

const successfulQueries = sourceBundle.coverage.queries.filter(
  (item) => item.status === "ok",
).length;
const successfulEditorialPages = sourceBundle.coverage.editorialPages.filter(
  (item) => item.status === "ok",
).length;
const requiredMediaQueries = [
  "site:theinformation.com",
  "site:bloomberg.com",
  "site:reuters.com",
  "site:finance.yahoo.com",
];
const missingRequiredMedia = requiredMediaQueries.filter(
  (prefix) =>
    !sourceBundle.coverage.queries.some(
      (item) => item.query.startsWith(prefix) && item.status === "ok",
    ),
);

if (
  successfulQueries < 20 ||
  successfulEditorialPages < 8 ||
  missingRequiredMedia.length
) {
  throw new Error(
    `Research coverage is incomplete: ${successfulQueries}/${sourceBundle.coverage.queries.length} queries, ` +
      `${successfulEditorialPages}/${sourceBundle.coverage.editorialPages.length} editorial pages, ` +
      `missing required media checks: ${missingRequiredMedia.join(", ") || "none"}. ` +
      "Refusing to publish a potentially false no-change report.",
  );
}

const outputShape = {
  date,
  displayDate,
  verifiedAt,
  status: "一句短状态",
  verdict: "完整的今日判断",
  top: ["不足三件不凑数"],
  items: [
    {
      severity: "major | watch | context",
      eyebrow: "领域标签",
      title: "标题",
      conclusion: "一句话结论",
      metrics: ["关键数字或日期"],
      sourceGrade: "A | B | B− | C",
      sourceNote: "信源性质和局限",
      impact: "对股东 thesis、估值、盈利、资本配置或流动性的影响",
      caveat: "克制点；没有则为 null",
      sources: [{ label: "来源名", href: "必须原样复制输入资料中的 URL" }],
    },
  ],
  watch: ["下次重点关注"],
};

const systemPrompt = `你是 ByteDance 股东视角每日增量监控研究员。你不能自行联网；只能分析用户提供的云端扫描结果。扫描器已执行 24 条中英文分维度查询，并直接抓取海外头部媒体编辑位、中文媒体最新页、相关正文和官方页面。

覆盖集团战略与财务，以及抖音、TikTok/TikTok Shop、国内外电商、本地生活、直播、豆包/Seed、Seedance/Seedream、火山引擎、飞书/Lark、CapCut/剪映、红果、番茄、即梦、扣子、PICO。

优先级：
1. GMV/GTV、收入、利润/利润率、take rate、订单、客单价、用户/付费用户、广告变现、市场份额、目标完成度、补贴ROI、商家数量/留存、货架与内容场占比；
2. 核心人员、汇报线、全员会、内部信和组织变化；
3. AI CapEx、芯片/算力/数据中心、ESOP、员工回购、一级半估值与供给、融资、IPO、拆分或资产交易；
4. 监管、诉讼、政策与地缘；
5. 重大产品、模型、合作和竞争变化。

海外头部媒体编辑位：The Information 的 Latest、Most Popular、The Briefing；Bloomberg 的 Technology、Markets；Reuters 的 Technology、Business、World；Yahoo Finance/Yahoo Tech。如果扫描文本显示字节相关内容进入首页头条、Top News、Latest 前列、Most Popular、Exclusive、Breaking、编辑精选或 Newsletter，自动升入最高优先级事件展开队列。编辑位置代表重要性，不代表多源确认。

任何全员会、内部信、管理层会议、组织调整、业务复盘、目标、低于预期、主干业务线索，都按事件对象展开：区分事件日与公开报道日；抽取集团战略、模型自评、经营数字、组织人才、TikTok/海外、资本配置。缺第二信源只降低置信度，不能成为漏报理由。

信源分级：A=官方/监管文件；B=可靠媒体独家或可信第三方；C=单一信源、社区转述或未确认线索。明确区分官方事实、公司口径、媒体报道、第三方估算、传闻和推断。

只报告相较上一份不同日期日报的新事实主张或实质进展。今天新发布的旧会议详情属于今日增量，标“历史重要补漏”。同一天重跑时，必须保留“已有今日版本”中仍然成立的新增，再追加迟到信息；不得因为重跑而把今天已经收录的内容删掉。没有重大新增时写“今日无重大新增”，top 可为空，不准用产品宣传凑数。

输入中的 priorityCandidates 是确定性规则筛出的高优先级候选。逐条检查所有候选：涉及经营数据、组织、人事、资本、监管或头部媒体编辑位的事实，不得因单一信源而忽略；信源不足时降低等级并标注待验证。若排除候选，必须在 verdict 或 watch 中说明它为什么不影响股东判断。媒体最新页出现字节相关标题时，优先使用扫描器展开的 editorial-article 正文，不要只按标题判断。

必须输出一个有效 JSON 对象，严格遵循用户给出的 JSON 示例结构。不要输出 Markdown、代码围栏或解释。每条 sources.href 必须从输入资料中原样复制，不得猜测或构造 URL。`;

const userPrompt = `当前北京时间：${verifiedAt}
本次日报 date 必须为 ${date}，displayDate 必须为 ${displayDate}，verifiedAt 必须为 ${verifiedAt}。

JSON 输出结构示例：
${JSON.stringify(outputShape, null, 2)}

上一份不同日期的公开日报（跨日去重基准）：
${JSON.stringify(previous, null, 2)}

今天已有版本（同日重跑时必须保留仍成立的新增并追加迟到信息）：
${JSON.stringify(existingToday, null, 2)}

本次云端扫描覆盖情况与公开资料：
${JSON.stringify(sourceBundle, null, 2)}`;

async function callArkDeepSeek(extraInstruction = "") {
  const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\n${extraInstruction}` },
      ],
      thinking: { type: "enabled" },
      response_format: { type: "json_object" },
      max_tokens: 12000,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Volcano Ark API failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.choices?.[0]?.message?.content ?? "";
}

let outputText = await callArkDeepSeek();
if (!outputText.trim()) {
  outputText = await callArkDeepSeek("上一次返回为空。请立即输出完整、有效的 JSON 对象。");
}
if (!outputText.trim()) throw new Error("Volcano Ark DeepSeek returned empty JSON output twice.");

const report = JSON.parse(outputText);
report.date = date;
report.displayDate = displayDate;
report.verifiedAt = verifiedAt;
report.top = Array.isArray(report.top) ? report.top.slice(0, 3) : [];
report.items = Array.isArray(report.items) ? report.items : [];
report.watch = Array.isArray(report.watch) ? report.watch : [];

function normalizeItemTitle(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function sourceUrls(item) {
  return new Set((item?.sources ?? []).map((source) => source?.href).filter(Boolean));
}

function sameItem(left, right) {
  const leftTitle = normalizeItemTitle(left?.title);
  const rightTitle = normalizeItemTitle(right?.title);
  if (leftTitle && leftTitle === rightTitle) return true;

  const leftUrls = sourceUrls(left);
  return [...sourceUrls(right)].some((url) => leftUrls.has(url));
}

const preservedTodayItems = [];
for (const item of existingToday?.items ?? []) {
  if (!report.items.some((candidate) => sameItem(candidate, item))) {
    report.items.push(item);
    preservedTodayItems.push(item);
  }
}

if (existingToday) {
  report.top = [...new Set([...report.top, ...(existingToday.top ?? [])])].slice(0, 3);
  if (preservedTodayItems.length && /无重大新增/.test(report.status ?? "")) {
    report.status = existingToday.status;
    report.verdict = `${report.verdict} 同日补跑已保留今天早先核实的有效增量。`;
  }
}

const allowedUrls = new Set();
for (const document of sourceBundle.documents) {
  if (document.url) allowedUrls.add(document.url);
  for (const match of document.snippet.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    allowedUrls.add(match[0]);
  }
}
for (const item of previous?.items ?? []) {
  for (const source of item.sources ?? []) allowedUrls.add(source.href);
}
for (const item of existingToday?.items ?? []) {
  for (const source of item.sources ?? []) allowedUrls.add(source.href);
}

for (const item of report.items) {
  if (!["major", "watch", "context"].includes(item.severity)) item.severity = "context";
  if (item.caveat === null) delete item.caveat;
  item.metrics = Array.isArray(item.metrics) ? item.metrics : [];
  item.sources = (Array.isArray(item.sources) ? item.sources : []).filter(
    (source) => source?.href && allowedUrls.has(source.href),
  );
  if (!item.sources.length) {
    throw new Error(`Report item has no source URL from the scanned corpus: ${item.title}`);
  }
}

for (const field of ["status", "verdict"]) {
  if (typeof report[field] !== "string" || !report[field].trim()) {
    throw new Error(`Report is missing required field: ${field}`);
  }
}

const nextReports = [report, ...reports.filter((item) => item.date !== date)];
await writeFile(reportsUrl, `${JSON.stringify(nextReports, null, 2)}\n`);
console.log(
  `${date}: ${report.status}; ${report.items.length} item(s); ` +
    `${successfulQueries}/${sourceBundle.coverage.queries.length} queries; ` +
    `${successfulEditorialPages}/${sourceBundle.coverage.editorialPages.length} editorial pages; ` +
    `${sourceBundle.coverage.editorialArticles.filter((item) => item.status === "ok").length}/${sourceBundle.coverage.editorialArticles.length} linked articles`,
);

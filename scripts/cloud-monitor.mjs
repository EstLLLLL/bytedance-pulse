import { readFile, writeFile } from "node:fs/promises";
import { collectPublicSources } from "./source-scan.mjs";

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  throw new Error(
    "DEEPSEEK_API_KEY is missing. Add it as a GitHub Actions repository secret before running the daily monitor.",
  );
}

const reportsUrl = new URL("../data/reports.json", import.meta.url);
const reports = JSON.parse(await readFile(reportsUrl, "utf8"));
const previous = reports[0] ?? null;
const sourceBundle = await collectPublicSources();

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

const systemPrompt = `你是 ByteDance 股东视角每日增量监控研究员。你不能自行联网；只能分析用户提供的云端扫描结果。扫描器已执行 20 条中英文分维度查询，并直接抓取海外头部媒体编辑位、中文媒体最新页和官方页面。

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

只报告相较上一份日报的新事实主张或实质进展。今天新发布的旧会议详情属于今日增量，标“历史重要补漏”。没有重大新增时写“今日无重大新增”，top 可为空，不准用产品宣传凑数。

必须输出一个有效 JSON 对象，严格遵循用户给出的 JSON 示例结构。不要输出 Markdown、代码围栏或解释。每条 sources.href 必须从输入资料中原样复制，不得猜测或构造 URL。`;

const userPrompt = `当前北京时间：${verifiedAt}
本次日报 date 必须为 ${date}，displayDate 必须为 ${displayDate}，verifiedAt 必须为 ${verifiedAt}。

JSON 输出结构示例：
${JSON.stringify(outputShape, null, 2)}

上一份公开日报（去重基准）：
${JSON.stringify(previous, null, 2)}

本次云端扫描覆盖情况与公开资料：
${JSON.stringify(sourceBundle, null, 2)}`;

async function callDeepSeek(extraInstruction = "") {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\n${extraInstruction}` },
      ],
      thinking: { type: "enabled" },
      reasoning_effort: "max",
      response_format: { type: "json_object" },
      max_tokens: 12000,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`DeepSeek API failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.choices?.[0]?.message?.content ?? "";
}

let outputText = await callDeepSeek();
if (!outputText.trim()) {
  outputText = await callDeepSeek("上一次返回为空。请立即输出完整、有效的 JSON 对象。");
}
if (!outputText.trim()) throw new Error("DeepSeek returned empty JSON output twice.");

const report = JSON.parse(outputText);
report.date = date;
report.displayDate = displayDate;
report.verifiedAt = verifiedAt;
report.top = Array.isArray(report.top) ? report.top.slice(0, 3) : [];
report.items = Array.isArray(report.items) ? report.items : [];
report.watch = Array.isArray(report.watch) ? report.watch : [];

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
    `${sourceBundle.coverage.queries.filter((item) => item.status === "ok").length}/20 queries; ` +
    `${sourceBundle.coverage.editorialPages.filter((item) => item.status === "ok").length}/${sourceBundle.coverage.editorialPages.length} editorial pages`,
);

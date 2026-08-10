import { readFile, writeFile } from "node:fs/promises";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error(
    "OPENAI_API_KEY is missing. Add it as a GitHub Actions repository secret before running the daily monitor.",
  );
}

const reportsUrl = new URL("../data/reports.json", import.meta.url);
const reports = JSON.parse(await readFile(reportsUrl, "utf8"));
const previous = reports[0] ?? null;

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

const reportSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string" },
    displayDate: { type: "string" },
    verifiedAt: { type: "string" },
    status: { type: "string" },
    verdict: { type: "string" },
    top: { type: "array", maxItems: 3, items: { type: "string" } },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["major", "watch", "context"] },
          eyebrow: { type: "string" },
          title: { type: "string" },
          conclusion: { type: "string" },
          metrics: { type: "array", items: { type: "string" } },
          sourceGrade: { type: "string" },
          sourceNote: { type: "string" },
          impact: { type: "string" },
          caveat: { type: ["string", "null"] },
          sources: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                href: { type: "string" },
              },
              required: ["label", "href"],
            },
          },
        },
        required: [
          "severity",
          "eyebrow",
          "title",
          "conclusion",
          "metrics",
          "sourceGrade",
          "sourceNote",
          "impact",
          "caveat",
          "sources",
        ],
      },
    },
    watch: { type: "array", items: { type: "string" } },
  },
  required: [
    "date",
    "displayDate",
    "verifiedAt",
    "status",
    "verdict",
    "top",
    "items",
    "watch",
  ],
};

const systemPrompt = `你是 ByteDance 股东视角每日增量监控研究员。使用 web_search 主动研究过去约 24–36 小时公开的新信息，并与上一份日报严格去重。

覆盖集团战略与财务，以及抖音、TikTok/TikTok Shop、国内外电商、本地生活、直播、豆包/Seed、Seedance/Seedream、火山引擎、飞书/Lark、CapCut/剪映、红果、番茄、即梦、扣子、PICO。

优先级：
1. GMV/GTV、收入、利润/利润率、take rate、订单、客单价、用户/付费用户、广告变现、市场份额、目标完成度、补贴ROI、商家数量/留存、货架与内容场占比；
2. 核心人员、汇报线、全员会、内部信和组织变化；
3. AI CapEx、芯片/算力/数据中心、ESOP、员工回购、一级半估值与供给、融资、IPO、拆分或资产交易；
4. 监管、诉讼、政策与地缘；
5. 重大产品、模型、合作和竞争变化。

完成至少 16–24 条中英文分维度检索。国内核心业务必须执行“业务名 × 经营指标”搜索；管理层事件必须单列检索“全员会/All Hands/年中会/季度复盘/战略会/内部信/讲话/纪要”以及梁汝波、张一鸣、周受资、谭待、赵祺、谢欣、郭平最近 72 小时动态。

海外头部媒体硬检查：直接检查 The Information 的首页、Latest、Most Popular、The Briefing；Bloomberg 的 Technology、Business、Markets；Reuters 的 Technology、Business、World/Legal；Yahoo Finance/Yahoo Tech。若字节相关内容进入首页头条、Top News、Latest 前列、Most Popular、Exclusive、Breaking、编辑精选或核心 Newsletter，必须进入最高优先级事件展开队列。Yahoo 转载须追溯 Reuters、Bloomberg、AP 等原始稿并按原始稿去重。

中文媒体至少覆盖：36氪、晚点 LatePost、财新、界面、第一财经、华尔街见闻、虎嗅、亿邦动力、未来消费、腾讯科技、新浪科技、澎湃。搜索引擎没有返回时，继续查媒体最新页、站内检索、转载和社区线索。

任何全员会、内部信、管理层会议、组织调整、业务复盘、目标、低于预期、主干业务线索，都必须作为事件对象展开：区分事件日与公开报道日；按高管和独特数字二次搜索；至少尝试搜索、媒体页面、转载/社区三类入口；抽取集团战略、模型自评、经营数字、组织人才、TikTok/海外、资本配置。缺第二信源只降低置信度，不能成为漏报理由。

信源分级：A=官方/监管文件；B=可靠媒体独家或可信第三方；C=单一信源、社区转述或未确认线索。明确区分官方事实、公司口径、媒体报道、第三方估算、传闻和你的推断。

只报告相较上一份日报的新事实主张或实质进展。今天新发布的旧会议详情属于今日增量，标“历史重要补漏”。没有重大新增时写“今日无重大新增”，top 可为空，不准用产品宣传凑数。每条必须包含结论、关键数字/日期、信源等级、股东影响、克制点和可直接访问的来源链接。用中文输出。`;

const userPrompt = `当前北京时间：${verifiedAt}
本次日报日期必须为 ${date}，displayDate 必须为 ${displayDate}，verifiedAt 必须为 ${verifiedAt}。

上一份公开日报如下。把它作为去重基准，不要重复旧闻；如果旧事件出现新的数字、管理层判断或可靠信源，按“事实主张”作为实质进展补报：
${JSON.stringify(previous, null, 2)}`;

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
    reasoning: { effort: "high" },
    tools: [{ type: "web_search" }],
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "bytedance_daily_report",
        strict: true,
        schema: reportSchema,
      },
    },
    max_output_tokens: 10000,
    store: false,
  }),
  signal: AbortSignal.timeout(30 * 60 * 1000),
});

const payload = await response.json();
if (!response.ok) {
  throw new Error(`OpenAI Responses API failed (${response.status}): ${JSON.stringify(payload)}`);
}

const outputText =
  payload.output_text ??
  payload.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
if (!outputText) throw new Error("The response did not include structured output text.");

const report = JSON.parse(outputText);
report.date = date;
report.displayDate = displayDate;
report.verifiedAt = verifiedAt;
for (const item of report.items) {
  if (item.caveat === null) delete item.caveat;
}

const nextReports = [report, ...reports.filter((item) => item.date !== date)];
await writeFile(reportsUrl, `${JSON.stringify(nextReports, null, 2)}\n`);
console.log(`${date}: ${report.status}; ${report.items.length} item(s)`);

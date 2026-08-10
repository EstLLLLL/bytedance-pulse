const response = await fetch("./reports.json", { cache: "no-store" });
if (!response.ok) throw new Error(`日报数据加载失败：${response.status}`);

const reports = await response.json();
const severityCopy = {
  major: "重大",
  watch: "值得注意",
  context: "背景 / 待验证",
};
const filters = [
  ["all", "全部"],
  ["major", "重大"],
  ["watch", "值得注意"],
  ["context", "背景"],
];

let activeDate = reports[0]?.date;
let activeFilter = "all";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeHref = (value = "") => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "#";
  } catch {
    return "#";
  }
};

function renderStory(item, index) {
  const metrics = item.metrics
    .map((metric) => `<span>${escapeHtml(metric)}</span>`)
    .join("");
  const sources = item.sources
    .map(
      (source) =>
        `<a href="${safeHref(source.href)}" rel="noreferrer" target="_blank">${escapeHtml(source.label)}<span aria-hidden="true"> ↗</span></a>`,
    )
    .join("");
  const caveat = item.caveat
    ? `<div class="caveat"><h4>克制点</h4><p>${escapeHtml(item.caveat)}</p></div>`
    : "";

  return `<article class="story-card story-${escapeHtml(item.severity)}" data-story-index="${index}">
    <div class="story-card-top">
      <span class="severity"><i aria-hidden="true"></i>${escapeHtml(severityCopy[item.severity])}</span>
      <span class="eyebrow">${escapeHtml(item.eyebrow)}</span>
    </div>
    <h3>${escapeHtml(item.title)}</h3>
    <p class="conclusion">${escapeHtml(item.conclusion)}</p>
    <div class="metrics" aria-label="关键数字">${metrics}</div>
    <div class="story-analysis">
      <div><h4>投资影响</h4><p>${escapeHtml(item.impact)}</p></div>
      <div><h4>信源判断</h4><p><b>${escapeHtml(item.sourceGrade)} 级</b> · ${escapeHtml(item.sourceNote)}</p></div>
      ${caveat}
    </div>
    <div class="source-row"><span>来源</span><div>${sources}</div></div>
  </article>`;
}

function render() {
  const report = reports.find((item) => item.date === activeDate) ?? reports[0];
  const visibleItems =
    activeFilter === "all"
      ? report.items
      : report.items.filter((item) => item.severity === activeFilter);
  const dateButtons = reports
    .map(
      (item) => `<button class="${item.date === report.date ? "active" : ""}" data-date="${escapeHtml(item.date)}" type="button">
        <span>${escapeHtml(item.displayDate)}</span><small>${escapeHtml(item.status)}</small>
      </button>`,
    )
    .join("");
  const filterButtons = filters
    .map(
      ([id, label]) => `<button class="${activeFilter === id ? "active" : ""}" data-filter="${id}" type="button">${label}</button>`,
    )
    .join("");
  const topStories = report.top.length
    ? report.top
        .map(
          (item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(item)}</p></li>`,
        )
        .join("")
    : '<li><span>—</span><p>今日无重大新增。</p></li>';
  const stories = visibleItems.length
    ? visibleItems.map(renderStory).join("")
    : '<div class="empty-state">这一天没有该等级的信息。</div>';
  const watch = report.watch
    .map(
      (item, index) => `<li><span>${index + 1}</span><p>${escapeHtml(item)}</p></li>`,
    )
    .join("");

  document.querySelector("#app").innerHTML = `<main>
    <header class="masthead">
      <a class="wordmark" href="#top" aria-label="字节脉搏首页">
        <span class="mark" aria-hidden="true">B</span>
        <span><strong>字节脉搏</strong><small>ByteDance Pulse</small></span>
      </a>
      <div class="masthead-meta"><span class="live-dot" aria-hidden="true"></span><span>每日增量监控</span><span class="divider" aria-hidden="true"></span><span>公开资料整理</span></div>
    </header>
    <section class="hero" id="top">
      <div class="hero-glow hero-glow-cyan" aria-hidden="true"></div><div class="hero-glow hero-glow-red" aria-hidden="true"></div>
      <div class="hero-main"><p class="kicker">INVESTOR INTELLIGENCE · ${escapeHtml(report.date)}</p><h1>把噪音拿掉，<br />只看真正影响判断的变化。</h1><p class="hero-deck">持续追踪字节跳动的经营、组织、资本配置、监管与关键产品进展。每天只记录相对上一期的新增，并区分事实、媒体报道与待验证线索。</p></div>
      <aside class="date-card" aria-label="当前日报"><span class="date-card-label">LATEST BRIEF</span><strong>${escapeHtml(report.displayDate)}</strong><span>${escapeHtml(report.status)}</span><small>核验截至 ${escapeHtml(report.verifiedAt.replace("北京时间 ", ""))}</small></aside>
    </section>
    <nav class="date-rail" aria-label="日报日期"><span class="rail-label">ARCHIVE</span>${dateButtons}</nav>
    <div class="page-grid"><article>
      <section class="verdict-panel"><div class="section-number">01</div><div><p class="section-label">TODAY'S VERDICT</p><h2>${escapeHtml(report.status)}</h2><p>${escapeHtml(report.verdict)}</p></div></section>
      <section class="top-stories"><div class="section-heading"><div><span class="section-number">02</span><p class="section-label">THE ESSENTIALS</p></div><h2>最重要的事</h2></div><ol>${topStories}</ol></section>
      <section class="story-section"><div class="story-toolbar"><div><span class="section-number">03</span><p class="section-label">SIGNALS</p><h2>新增与进展</h2></div><div class="filters" aria-label="按重要性筛选">${filterButtons}</div></div><div class="stories">${stories}</div></section>
      <section class="watch-section"><div><span class="section-number">04</span><p class="section-label">NEXT WATCH</p><h2>下次重点关注</h2></div><ol>${watch}</ol></section>
    </article><aside class="method-card"><span class="section-label">METHOD</span><h2>这份监控如何阅读</h2><p>先看经营和组织，再看资本配置、监管与产品。没有实质变化时明确写“无重大新增”，不为凑数重复旧闻。</p><dl><div><dt>A</dt><dd>官方公告、监管文件</dd></div><div><dt>B</dt><dd>可靠媒体或第三方数据</dd></div><div><dt>C</dt><dd>单一信源、社区或待验证线索</dd></div></dl><p class="method-note">本站只整理公开信息，不包含个人身份、持仓信息或私人研究笔记；内容仅供研究参考，不构成投资建议。</p></aside></div>
    <footer><div><span class="mark small" aria-hidden="true">B</span><span>字节脉搏 · ByteDance Pulse</span></div><p>PUBLIC-SOURCE RESEARCH · UPDATED DAILY</p></footer>
  </main>`;

  document.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      activeDate = button.dataset.date;
      activeFilter = "all";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      render();
    });
  });
}

render();

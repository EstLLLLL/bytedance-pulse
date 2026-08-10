# 字节脉搏 · ByteDance Pulse

公开的 ByteDance 股东视角每日增量监控站点。内容只来自公开资料，按日期保存结论、关键数字、信源等级、股东影响与待验证事项。

## 公开边界

- 公开：每日新闻、公开来源链接、信源判断与投资影响分析。
- 不公开：个人身份、持仓信息、私人研究笔记和本地 Obsidian 主 Wiki。
- 云端任务只读取仓库中的上一份公开日报，用它做增量去重。

## 云端运行

GitHub Actions 每天北京时间 08:30 运行研究任务，更新 `data/reports.json`，随后自动部署 GitHub Pages。云端扫描器先执行 24 条中英文检索，其中四条专门检查全员会、内部信、管理层讲话和各业务线 All Hands；同时检查媒体编辑位，并打开最新页中的字节相关正文以及标题未提字节、但正文可能包含管理层事件的候选文章，再将公开资料交给火山方舟托管的 DeepSeek 分析。同一天补跑会合并迟到信息，并以程序规则保留已核实的当日增量。若检索覆盖、海外头部媒体检查或媒体页覆盖不足，任务会直接失败并保留上一份日报，不会发布“今日无重大新增”。仓库需要 `ARK_API_KEY` 和 `ARK_MODEL` 两个 Actions secrets；未配置时，定时流程会安静跳过，不会改动网站。

也可以在 Actions 页面手动运行 `Daily ByteDance monitor`，用于首次校准或补跑。

## 本地验证

```bash
npm install
npm run build
npm test
npm run build:static
```

云端研究通过火山方舟的 OpenAI 兼容接口调用指定的 DeepSeek 模型，并使用 JSON Output 生成结构化日报；新闻搜索与网页抓取仍由独立扫描器完成。

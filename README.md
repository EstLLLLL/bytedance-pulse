# 字节脉搏 · ByteDance Pulse

公开的 ByteDance 股东视角每日增量监控站点。内容只来自公开资料，按日期保存结论、关键数字、信源等级、股东影响与待验证事项。

## 公开边界

- 公开：每日新闻、公开来源链接、信源判断与投资影响分析。
- 不公开：个人身份、持仓信息、私人研究笔记和本地 Obsidian 主 Wiki。
- 云端任务只读取仓库中的上一份公开日报，用它做增量去重。

## 云端运行

GitHub Actions 每天北京时间 08:30 运行研究任务，更新 `data/reports.json`，随后自动部署 GitHub Pages。首次运行前，在仓库 Settings → Secrets and variables → Actions 中添加名为 `OPENAI_API_KEY` 的 repository secret。

也可以在 Actions 页面手动运行 `Daily ByteDance monitor`，用于首次校准或补跑。

## 本地验证

```bash
npm install
npm run build
npm test
npm run build:static
```

云端研究使用 OpenAI Responses API 的 Web Search，并要求结构化日报输出。模型默认为 `gpt-5.6-sol`。

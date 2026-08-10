# 字节脉搏 · ByteDance Pulse

公开的 ByteDance 股东视角每日增量监控站点。内容只来自公开资料，按日期保存结论、关键数字、信源等级、股东影响与待验证事项。

## 公开边界

- 公开：每日新闻、公开来源链接、信源判断与投资影响分析。
- 不公开：个人身份、持仓信息、私人研究笔记和本地 Obsidian 主 Wiki。
- 云端任务只读取仓库中的上一份公开日报，用它做增量去重。

## 云端运行

GitHub Actions 每天北京时间 08:30 运行研究任务，更新 `data/reports.json`，随后自动部署 GitHub Pages。云端扫描器先执行 20 条中英文检索并检查媒体编辑位，再将公开资料交给 DeepSeek 分析。仓库需要名为 `DEEPSEEK_API_KEY` 的 Actions secret；未配置时，定时流程会安静跳过，不会改动网站。

也可以在 Actions 页面手动运行 `Daily ByteDance monitor`，用于首次校准或补跑。

## 本地验证

```bash
npm install
npm run build
npm test
npm run build:static
```

云端研究的模型默认为 `deepseek-v4-pro`，使用 DeepSeek JSON Output 生成结构化日报；新闻搜索与网页抓取由独立扫描器完成。

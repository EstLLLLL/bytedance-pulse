import assert from "node:assert/strict";
import test from "node:test";
import {
  extractArticleLinks,
  extractRelevantLinks,
} from "../scripts/source-scan.mjs";

test("preserves ByteDance article links from a media latest page", () => {
  const html = `
    <a href="/p/3933070123089287">字节 Seedance 爆火背后，藏着一只 50 亿美元的独角兽</a>
    <a href="/p/unrelated">另一条普通行业新闻</a>
  `;

  assert.deepEqual(extractRelevantLinks(html, "https://www.36kr.com/latest"), [
    {
      title: "字节 Seedance 爆火背后，藏着一只 50 亿美元的独角兽",
      url: "https://www.36kr.com/p/3933070123089287",
    },
  ]);
});

test("keeps article-shaped media links even when the headline omits ByteDance", () => {
  const html = `
    <a href="/p/3929206861731715">千问App办公收费，阿里的组织题只答了一半</a>
    <a href="/information/web_news/latest/">最新资讯</a>
  `;

  assert.deepEqual(extractArticleLinks(html, "https://www.36kr.com/latest"), [
    {
      title: "千问App办公收费，阿里的组织题只答了一半",
      url: "https://www.36kr.com/p/3929206861731715",
    },
  ]);
});

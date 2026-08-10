import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("../site-dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
await writeFile(
  new URL("styles.css", output),
  css.replace(/^@import\s+["']tailwindcss["'];\s*/m, ""),
);

await Promise.all([
  cp(new URL("../static/index.html", import.meta.url), new URL("index.html", output)),
  cp(new URL("../static/app.js", import.meta.url), new URL("app.js", output)),
  cp(new URL("../data/reports.json", import.meta.url), new URL("reports.json", output)),
  cp(new URL("../public/favicon.svg", import.meta.url), new URL("favicon.svg", output)),
  cp(new URL("../public/og.png", import.meta.url), new URL("og.png", output)),
]);

await writeFile(new URL(".nojekyll", output), "");
console.log(new URL("index.html", output).pathname);

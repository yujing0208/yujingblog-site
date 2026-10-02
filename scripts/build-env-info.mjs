// scripts/build-env-info.mjs — 构建时把关键依赖的实际解析版本写入 public/build-info.txt
// 用于诊断线上构建环境的依赖组合（尤其是 micromark-util-character）
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const req = createRequire(import.meta.url);
// pnpm 严格隔离：传递依赖需从真实运行时位置解析
// micromark-util-character 在运行时由 micromark-extension-directive 加载，须从它的位置 resolve
const subReq = createRequire(req.resolve("remark-directive"));
const extReq = createRequire(subReq.resolve("micromark-extension-directive"));
const PKGS = [
  ["micromark-util-character", extReq],
  ["micromark-extension-directive", subReq],
  ["remark-directive", req],
  ["mdast-util-directive", subReq],
  ["@astrojs/markdown-remark", req],
  ["micromark", extReq],
];

const lines = [];
lines.push("node=" + process.version);
lines.push("cwd=" + process.cwd());

for (const [name, resolver] of PKGS) {
  try {
    const entry = resolver.resolve(name);
    const dir = path.dirname(entry);
    // entry 可能是 .../index.js 或 .../dist/index.js；向上找 package.json
    let pjPath = null;
    let d = dir;
    for (let i = 0; i < 4; i++) {
      const candidate = path.join(d, "package.json");
      if (existsSync(candidate)) { pjPath = candidate; break; }
      d = path.dirname(d);
    }
    if (pjPath) {
      const pj = JSON.parse(readFileSync(pjPath, "utf8"));
      lines.push(`${name}=${pj.version} @ ${pjPath}`);
    } else {
      lines.push(`${name}=entry@${entry} (no package.json found)`);
    }
  } catch (e) {
    lines.push(`${name}=ERROR ${String(e.message).slice(0, 120)}`);
  }
}

// 直接验证 unicodePunctuation 行为（决定性检查）
try {
  const ucEntry = extReq.resolve("micromark-util-character");
  const uc = await import(pathToFileURL(ucEntry).href);
  const eq = "=".charCodeAt(0);
  const us = "_".charCodeAt(0);
  lines.push(`unicodePunctuation('=')=${uc.unicodePunctuation(eq)} (expect true w/ 2.1.x)`);
  lines.push(`unicodePunctuation('_')=${uc.unicodePunctuation(us)} (expect true)`);
} catch (e) {
  lines.push("unicodePunctuation check ERROR " + String(e.message).slice(0, 120));
}

// ---- 决定性检查：用真实管线渲染真实文章，结果写入 build-info.txt ----
// 区分两种假设：
//   A) Vercel 构建环境渲染 OK，但线上 HTML 是旧渲染缓存复用 → cards>0 且线上仍字面量
//   B) Vercel 构建环境里渲染本身就失败 → cards=0
// 插件清单与 astro.config.mjs 的 markdown.processor 完全一致（直接导入，绕开 config 里
// 无扩展名 .js->.ts 映射——Vite 能解析而纯 Node 不能，不影响真实构建）。
try {
  const root = process.cwd();
  // rehype-mermaid.mjs 用了 Vite 的 `?raw` 导入，纯 Node 不支持：
  // 在 .diagtmp/ 生成补丁副本（?raw -> 预生成 default 导出的 shim 模块）
  const diagTmp = path.join(root, ".diagtmp");
  mkdirSync(diagTmp, { recursive: true });
  const scriptContent = readFileSync(path.join(root, "src/plugins/mermaid-render-script.js"), "utf8");
  writeFileSync(path.join(diagTmp, "mermaid-render-script.js"),
    "export default " + JSON.stringify(scriptContent) + ";\n", "utf8");
  const mermaidSrc = readFileSync(path.join(root, "src/plugins/rehype-mermaid.mjs"), "utf8");
  writeFileSync(path.join(diagTmp, "rehype-mermaid.mjs"),
    mermaidSrc.replace('"/src/plugins/mermaid-render-script.js?raw"', '"/mermaid-render-script.js"')
      .replace('"./mermaid-render-script.js?raw"', '"./mermaid-render-script.js"'), "utf8");
  const local = (p) => import(pathToFileURL(path.join(root, p)).href);
  const localPatched = (p) => import(pathToFileURL(path.join(diagTmp, p)).href);
  const [
    { remarkStripLeadingTitle }, { remarkContent }, { remarkFixGithubAdmonitions },
    { remarkEscapeNumericColons }, { parseDirectiveNode }, { remarkMermaid },
    { remarkWikiLink }, { rehypeWrapTable }, { rehypeFlatpaperTabs },
    { GithubCardComponent }, { ImageGridComponent }, { AdmonitionComponent },
    { rehypeImageWidth }, { rehypeMermaid },
  ] = await Promise.all([
    local("src/plugins/remark-strip-leading-title.mjs"),
    local("src/plugins/remark-content.mjs"),
    local("src/plugins/remark-fix-github-admonitions.js"),
    local("src/plugins/remark-escape-numeric-colons.mjs"),
    local("src/plugins/remark-directive-rehype.js"),
    local("src/plugins/remark-mermaid.js"),
    local("src/plugins/remark-wiki-link.mjs"),
    local("src/plugins/rehype-wrap-table.mjs"),
    local("src/plugins/rehype-flatpaper-tabs.mjs"),
    local("src/plugins/rehype-component-github-card.mjs"),
    local("src/plugins/rehype-component-image-grid.mjs"),
    local("src/plugins/rehype-component-admonition.mjs"),
    local("src/plugins/rehype-image-width.mjs"),
    localPatched("rehype-mermaid.mjs"),
  ]);
  const [
    remarkMath, remarkDirective, remarkSectionize,
    rehypeKatex, rehypeExternalLinks, rehypeSlug, rehypeComponents, rehypeAutolinkHeadings,
  ] = await Promise.all([
    import("remark-math").then((m) => m.default),
    import("remark-directive").then((m) => m.default),
    import("remark-sectionize").then((m) => m.default),
    import("rehype-katex").then((m) => m.default),
    import("rehype-external-links").then((m) => m.default),
    import("rehype-slug").then((m) => m.default),
    import("rehype-components").then((m) => m.default),
    import("rehype-autolink-headings").then((m) => m.default),
  ]);
  const { unified } = await import("@astrojs/markdown-remark");
  const { createMarkdownProcessor } = await import("@astrojs/markdown-remark");
  // 与 @astrojs/markdown-remark/dist/processor.js 的 createRenderer 等价
  const realProc = await createMarkdownProcessor({
    gfm: true,
    smartypants: true,
    remarkPlugins: [
      remarkStripLeadingTitle, remarkMath, remarkContent, remarkFixGithubAdmonitions,
      remarkDirective, remarkEscapeNumericColons, remarkSectionize, parseDirectiveNode,
      remarkMermaid, remarkWikiLink,
    ],
    rehypePlugins: [
      rehypeKatex,
      [rehypeExternalLinks, { target: "_blank", rel: ["nofollow", "noopener", "noreferrer"] }],
      rehypeSlug, rehypeWrapTable, rehypeFlatpaperTabs, rehypeMermaid,
      [rehypeComponents, {
        components: {
          github: GithubCardComponent,
          grid: ImageGridComponent,
          note: (x, y) => AdmonitionComponent(x, y, "note"),
          primary: (x, y) => AdmonitionComponent(x, y, "primary"),
          info: (x, y) => AdmonitionComponent(x, y, "info"),
          success: (x, y) => AdmonitionComponent(x, y, "success"),
          danger: (x, y) => AdmonitionComponent(x, y, "danger"),
          error: (x, y) => AdmonitionComponent(x, y, "danger"),
          tip: (x, y) => AdmonitionComponent(x, y, "tip"),
          important: (x, y) => AdmonitionComponent(x, y, "important"),
          caution: (x, y) => AdmonitionComponent(x, y, "caution"),
          warning: (x, y) => AdmonitionComponent(x, y, "warning"),
        },
      }],
      [rehypeAutolinkHeadings, {
        behavior: "append",
        properties: { className: ["anchor"] },
        content: {
          type: "element", tagName: "span",
          properties: { className: ["anchor-icon"], "data-pagefind-ignore": true },
          children: [{ type: "text", value: "#" }],
        },
      }],
      rehypeImageWidth,
    ],
  });
  lines.push(`env: ENABLE_CONTENT_SYNC=${process.env.ENABLE_CONTENT_SYNC ?? "(unset)"} CONTENT_DIR=${process.env.CONTENT_DIR ?? "(unset)"} CI=${process.env.CI ?? "(unset)"}`);
  // 内容目录在 Vercel 上可能与本地不同（CONTENT_DIR 环境变量决定），自动发现文章路径
  const candidates = [
    path.join(root, "content", "posts", "lx-music-guide.md"),
    path.join(root, "src", "content", "posts", "lx-music-guide.md"),
  ];
  let mdFile = null;
  for (const c of candidates) {
    if (existsSync(c)) { mdFile = c; break; }
  }
  if (!mdFile) {
    // 兜底：浅层递归搜索（最多 4 层，跳过 node_modules/.git）
    const search = (dir, depth) => {
      if (depth > 4 || mdFile) return;
      let ents;
      try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) search(p, depth + 1);
        else if (e.name === "lx-music-guide.md") { mdFile = p; return; }
      }
    };
    search(root, 0);
  }
  lines.push("md-file: " + (mdFile ?? "NOT FOUND"));
  if (!mdFile) throw new Error("lx-music-guide.md not found anywhere under cwd");
  const raw = readFileSync(mdFile, "utf8");
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const rendered = await realProc.render(body);
  const cards = (rendered.code.match(/card-github/g) || []).length;
  const rawDirectives = (rendered.code.match(/::github/g) || []).length;
  lines.push(`render-check: cards=${cards} raw-gh=${rawDirectives} len=${rendered.code.length}`);
  // 记录渲染输出里 directive 附近的片段，便于失败时定位
  const idx = rendered.code.indexOf("::github");
  if (idx >= 0) {
    lines.push("render-context: " + rendered.code.slice(Math.max(0, idx - 60), idx + 80).replace(/\s+/g, " "));
  }
} catch (e) {
  lines.push("render-check: ERROR " + String(e && e.message ? e.message : e).slice(0, 300));
  if (e && e.stack) lines.push("render-stack: " + e.stack.split("\n").slice(0, 4).join(" | ").slice(0, 300));
}

const out = lines.join("\n") + "\n";
try {
  mkdirSync("public", { recursive: true });
  writeFileSync("public/build-info.txt", out, "utf8");
  console.log("build-info.txt written:\n" + out);
} catch (e) {
  console.log("build-info write FAILED: " + e.message);
}

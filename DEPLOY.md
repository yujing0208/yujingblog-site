# 部署配置说明（站点仓库 yujingblog-site）

本仓库的部署由 GitHub Actions 全权负责（构建 + 用 Vercel Token 直接部署产物），
**不再依赖 Vercel 的 Git 自动部署，也不再使用明文 Deploy Hook**。

以下内容需在 GitHub / Vercel 面板手动配置一次。仓库代码里只引用 Secret 名，不含任何明文密钥。

---

## 一、GitHub Secrets（本仓库 yujingblog-site）

路径：仓库 → Settings → Secrets and variables → Actions → New repository secret

| Secret 名          | 用途                                                         | 获取方式                                                                 |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `VERCEL_TOKEN`     | Vercel CLI 登录并部署产物的账户 Token                        | Vercel → 右上角头像 → Settings → Tokens → Create Token                    |
| `VERCEL_ORG_ID`    | Vercel 团队 / 个人账户 ID                                    | Vercel 项目 → Settings → General → Team ID / Account ID（页面 URL 含此值） |
| `VERCEL_PROJECT_ID`| 本 Vercel 项目的 Project ID                                  | Vercel 项目 → Settings → General → Project ID                            |
| `DISPATCH_TOKEN`   | 供内容仓库向本仓库发送 `repository_dispatch` 的 GitHub PAT   | GitHub → Settings → Developer settings → Personal access tokens → 新建，勾选 `repo` 与 `workflow` 权限 |
| `CONTENT_REPO_TOKEN` | 读取**私有**内容仓库 `yujingblog-content`（2026-10-03 起必需） | 同上，勾选 `repo` 即可；不填则回落到 `DISPATCH_TOKEN` |

> 注意：`DISPATCH_TOKEN` 必须是**站点仓库（yujingblog-site）有写权限**的 PAT，内容仓库用它通过 API 触发本仓库的 Deploy Site workflow。

> **内容仓库转私有后的凭据**（2026-10-03）：
>
> 内容仓库 `yujing0208/yujingblog-content` 转为私有后（2026-10-03），构建期与镜像同步都需要带凭据访问：
>
> - **GitHub Actions**：`content-mirror.yml` 用 `secrets.CONTENT_REPO_TOKEN`，未配置时回落到 `secrets.DISPATCH_TOKEN`（同一个 PAT，`repo` 权限即可读该私有仓）。
> - **Vercel 构建**：项目 Environment Variables 需有 `CONTENT_REPO_TOKEN`；未配置时 `sync-content.js` 会回落到 `GH_TOKEN`（在线编辑器用的那个 PAT）。
> - 两者都没有时，clone 会 401，`scripts/prebuild.js` 会在 CI 下直接让构建失败（不会静默产出空博客）。
>
> token 只作为单次 git 命令的 http header 使用，不会写进 `content/.git/config` 的 remote URL。

---

## 二、Vercel 项目设置（关键，否则会双部署）

路径：Vercel → 项目 → Settings → Git

1. 关闭 **「Auto Deploy on Push」/「Produce Preview on Push」** 之类与 Git push 绑定的自动部署开关，
   让 GitHub Actions 成为**唯一**的部署入口。
2. 删除后台残留的旧 **Deploy Hook**（`prj_s44cNpfUAFZSbBgQ6lbrIUrjL2iX` 下的 `mr4m8L3URJ` / `C0tPxPcijZ`），
   避免任何人仍能通过明文链接触发构建。
3. 保留 `vercel.json` 中的 `env.ENABLE_CONTENT_SYNC` / `CONTENT_REPO_URL` 不变（Actions 构建时会同步内容仓库）。
4. **新增**：项目 → Settings → Environment Variables，加一个
   `CONTENT_REPO_TOKEN`（GitHub PAT，勾选内容仓库的 `Contents: Read`）。
   内容仓库转私有后构建期 `git clone` 需要它，缺失会导致构建失败。
   注意：不要把它写进 `vercel.json` 的 `env` 段——那个文件是明文随仓库走的。

---

## 三、部署链路总览

```
内容仓库 push master
   └─> trigger-vercel.yml (内容仓库)
          └─> repository_dispatch(deploy-site)  ── 用 DISPATCH_TOKEN
                 └─> Deploy Site workflow (站点仓库)
                        ├─ pnpm build (prebuild 钩子 sync-content 拉取内容)
                        └─> vercel deploy --prebuilt --prod  ── 用 VERCEL_TOKEN/ORG/PROJECT

站点仓库 push main
   └─> Deploy Site workflow (站点仓库，监听 main)
          ├─ pnpm build
          └─> vercel deploy --prebuilt --prod
```

全链路每次变更只构建并部署 **一次**。

---

## 四、本地/CI 构建命令

```bash
pnpm install
pnpm build        # = update-anime + astro build + pagefind
```

`prebuild` 钩子会执行 `scripts/prebuild.js`，它先跑 `scripts/sync-content.js` 把内容仓库映射进站点，
再跑 `scripts/build-env-info.mjs`。

**内容同步失败时**（例如私有内容仓库缺凭据导致 clone 401）：

- 在 CI / Vercel 下：构建**直接失败**。这是有意为之——否则会产出一个零篇文章的「空博客」并静默上线。
- 在本地：仅打印警告后继续，方便还没 clone 内容仓时跑 `astro dev`。
  想在本地也硬失败，设 `FORCE_CONTENT_SYNC=true`。

本地开发时内容仓库来自上一次 clone，`sync-content.js` 会先 `git fetch` 再 `reset --hard`；
私有仓需保证本机有该仓的读凭据（`gh auth login` 或 SSH key）。

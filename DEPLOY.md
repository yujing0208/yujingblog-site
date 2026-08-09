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

> 注意：`DISPATCH_TOKEN` 必须是**站点仓库（yujingblog-site）有写权限**的 PAT，内容仓库用它通过 API 触发本仓库的 Deploy Site workflow。

---

## 二、Vercel 项目设置（关键，否则会双部署）

路径：Vercel → 项目 → Settings → Git

1. 关闭 **「Auto Deploy on Push」/「Produce Preview on Push」** 之类与 Git push 绑定的自动部署开关，
   让 GitHub Actions 成为**唯一**的部署入口。
2. 删除后台残留的旧 **Deploy Hook**（`prj_s44cNpfUAFZSbBgQ6lbrIUrjL2iX` 下的 `mr4m8L3URJ` / `C0tPxPcijZ`），
   避免任何人仍能通过明文链接触发构建。
3. 保留 `vercel.json` 中的 `env.ENABLE_CONTENT_SYNC` / `CONTENT_REPO_URL` 不变（Actions 构建时会同步内容仓库）。

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

`prebuild` 钩子会自动执行 `scripts/sync-content.js` 把内容仓库映射进站点。

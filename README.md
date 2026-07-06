<div align="center">
  <a href="https://r2explorer.com/">
    <img src="https://raw.githubusercontent.com/G4brym/R2-explorer/refs/heads/main/packages/docs/public/assets/r2-explorer-logo.png" width="500" height="auto" alt="R2-Explorer"/>
  </a>
</div>

<p align="center">
  <em>面向 Cloudflare R2 Bucket 的类 Google Drive 文件管理界面</em>
</p>

<p align="center">
  <a href="https://github.com/G4brym/R2-Explorer/commits/main" target="_blank">
    <img src="https://img.shields.io/github/commit-activity/m/G4brym/R2-Explorer?label=Commits&style=social" alt="R2-Explorer Commits">
  </a>
  <a href="https://github.com/G4brym/R2-Explorer/issues" target="_blank">
    <img src="https://img.shields.io/github/issues/G4brym/R2-Explorer?style=social" alt="Issues">
  </a>
  <a href="https://github.com/G4brym/R2-Explorer/blob/main/LICENSE" target="_blank">
    <img src="https://img.shields.io/badge/license-MIT-brightgreen.svg?style=social" alt="Software License">
  </a>
</p>

# R2-Explorer

R2-Explorer 是一个运行在 Cloudflare Workers 上的 R2 文件管理应用，提供类似网盘的文件浏览、上传、预览、分享、公开访问控制和 API 能力。该仓库包含 Worker 后端、Vue/Quasar 前端 Dashboard，以及当前部署所需的自定义 API 增强。

[部署到 Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/r2-explorer-template)

## 快速链接

- 官方文档：[r2explorer.com](https://r2explorer.com)
- 在线演示：[demo.r2explorer.com](https://demo.r2explorer.com)
- 上游源码：[github.com/G4brym/R2-Explorer](https://github.com/G4brym/R2-Explorer)
- 当前示例域名：`https://iptv.303066.xyz`

## 功能概览

- 文件管理：文件夹浏览、拖拽上传、文件夹上传、创建文件夹、重命名、复制、移动、删除。
- 大文件支持：保留原有 multipart 上传能力。
- 文件预览：支持 PDF、图片、文本、Markdown、CSV、日志文件等常见格式。
- 元数据管理：支持 HTTP metadata 和 custom metadata 编辑。
- 分享链接：支持生成 `/share/<shareId>` 链接，可配置密码、过期时间和下载次数限制。
- 公开访问：支持将指定文件或目录标记为公开，通过根路径直接访问对象。
- 鉴权：支持 Basic Auth、Cloudflare Access、API Token。
- 邮件集成：支持 Cloudflare Email Routing，将邮件和附件保存到 R2 并在界面中查看。
- 简化 API：新增不把 bucket 和对象 key 放入路径的 `/api/list`、`/api/file`、`/api/upload` 等接口。
- 多文件发布上传：`/api/upload` 支持 `multipart/form-data`，可一次上传多个发布产物。

## 项目结构

```text
R2-Explorer/
├── packages/
│   ├── worker/          # Cloudflare Worker 后端
│   ├── dashboard/       # Vue 3 + Quasar 前端
│   ├── docs/            # 文档站点
│   └── github-action/   # GitHub Action 部署工具
├── template/            # 用户部署模板
├── package.json
└── pnpm-workspace.yaml
```

## 本地开发

安装依赖：

```bash
pnpm install
```

构建所有包：

```bash
pnpm build
```

常用命令：

```bash
pnpm lint
pnpm test
pnpm build-dashboard
pnpm build-worker
```

Worker 测试：

```bash
cd packages/worker
pnpm test
```

## 部署说明

当前 Worker 部署配置位于：

```text
packages/worker/dev/wrangler.toml
```

当前部署目标：

```text
Worker: iptv-r2-manager
R2 binding: R2
R2 bucket: iptv-assets
Public base URL: https://iptv.303066.xyz
```

部署前建议先构建前端资产：

```bash
pnpm build-dashboard
```

预检部署：

```bash
cd packages/worker/dev
pnpm exec wrangler deploy --dry-run
```

正式部署：

```bash
cd packages/worker/dev
pnpm exec wrangler deploy
```

## 管理入口

- 管理后台：`/admin`
- 未登录访问 `/admin` 会跳转到 `/auth/login?next=/admin`
- 登录后默认进入第一个 R2 bucket 的文件列表，例如 `/R2/files`

默认兜底凭据只在没有配置环境变量或 secret 时使用：

| 配置 | 环境变量或 Secret | 默认值 |
| --- | --- | --- |
| 管理用户名 | `BASIC_AUTH_USERNAME` | `admin` |
| 管理密码 | `BASIC_AUTH_PASSWORD` | `codingriver` |
| API Token | `API_TOKEN` | `codingriver` |

生产环境必须使用 Cloudflare secret 设置真实密码和 token：

```bash
wrangler secret put BASIC_AUTH_PASSWORD
wrangler secret put API_TOKEN
```

`BASIC_AUTH_USERNAME` 可以作为普通 Worker 变量配置，也可以按需设置为 secret。

## 安全注意事项

- 不要提交真实密码、API Token、`.dev.vars`、`.env`、`.wrangler/`、`node_modules/` 或构建产物。
- 文档和示例中只使用占位符，例如 `your-domain.example`、`your-api-token`、`your-password`。
- API Token 可以通过 `Authorization: Bearer <token>` 或 `x-api-key` 传递。
- `GET` 和 `HEAD` 请求额外支持 `?token=...`，便于播放器、浏览器或简单脚本读取。
- 写入类请求不接受 query token，必须使用 header 传递 token。

## API 概览

新增简化 API 不再把 bucket binding 或对象 key 放在路径中。只有一个 R2 bucket 绑定时可以省略 `bucket`；多个 bucket 时可通过 query 或 JSON body 传入 `bucket`。

```bash
BASE_URL="https://your-domain.example"
API_TOKEN="your-api-token"
```

当前域名示例：

```bash
BASE_URL="https://iptv.303066.xyz"
```

对象路径使用普通字符串，不需要 base64。路径中包含空格、中文、`?`、`#`、`&` 等 URL 敏感字符时，需要进行 URL 编码。

### 鉴权方式

读请求可以把 token 放在 query 中：

```bash
curl "${BASE_URL}/api/list?token=${API_TOKEN}"
```

写请求使用 header：

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  "${BASE_URL}/api/delete"
```

也支持：

```bash
curl -H "x-api-key: ${API_TOKEN}" "${BASE_URL}/api/server/config"
curl -u "admin:your-password" "${BASE_URL}/api/server/config"
```

### Bucket 默认规则

Bucket 解析顺序：

1. 请求参数 `bucket`
2. Worker 配置 `defaultBucket`
3. Worker 环境变量 `DEFAULT_BUCKET`
4. 如果只有一个 R2 bucket binding，自动使用该 bucket
5. 如果存在多个 bucket 且没有指定默认值，返回 `400`

显式指定 bucket：

```bash
curl "${BASE_URL}/api/list?bucket=R2&token=${API_TOKEN}"
```

### 获取服务配置

```bash
curl "${BASE_URL}/api/config?token=${API_TOKEN}"
```

兼容的旧配置接口仍然保留：

```bash
curl "${BASE_URL}/api/server/config?token=${API_TOKEN}"
```

### 列出文件

接口：

```text
GET /api/list
```

参数：

| 参数 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `bucket` | 否 | `R2` | 多 bucket 时指定绑定名 |
| `prefix` | 否 | `folder/` | 文件夹前缀 |
| `delimiter` | 否 | `/` | 使用 `/` 获得类似文件夹的列表 |
| `cursor` | 否 | `...` | 分页游标 |
| `limit` | 否 | `100` | 返回对象数量上限 |
| `include` | 否 | `httpMetadata` | 可重复传 `httpMetadata` 和 `customMetadata` |
| `token` | GET 必需 | `your-api-token` | API token |

示例：

```bash
curl "${BASE_URL}/api/list?prefix=folder/&delimiter=/&token=${API_TOKEN}"
```

### 下载文件

接口：

```text
GET /api/file
```

示例：

```bash
curl "${BASE_URL}/api/file?path=folder/demo.txt&token=${API_TOKEN}" \
  -o demo.txt
```

### 上传单个文件

接口：

```text
POST /api/upload
```

单文件二进制上传会直接把请求 body 作为文件流写入 R2，适合大文件或简单脚本：

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: text/plain" \
  --data-binary "@demo.txt" \
  "${BASE_URL}/api/upload?path=folder/demo.txt"
```

多 bucket 时：

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  --data-binary "@demo.txt" \
  "${BASE_URL}/api/upload?bucket=R2&path=folder/demo.txt"
```

### 一次上传多个文件

`/api/upload` 同时支持 `multipart/form-data`，可一次发布多个文件，适合 IPTV 列表、静态索引、构建产物等场景。

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -F "source=iptv-picker" \
  -F "category=live" \
  -F "files=@publish/iptv.m3u;type=application/vnd.apple.mpegurl" \
  -F "files=@publish/iptv.txt;type=text/plain" \
  -F "files=@publish/iptv.json;type=application/json" \
  "${BASE_URL}/api/upload"
```

传入 `category=live` 时，上面的文件会写入：

```text
live/iptv.m3u
live/iptv.txt
live/iptv.json
```

multipart 参数：

| 参数 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `files` | 是 | `@publish/iptv.m3u` | 可重复传多个文件 |
| `bucket` | 否 | `R2` | 多 bucket 时指定绑定名 |
| `path` | 否 | `folder/demo.txt` | 单文件上传时可指定完整对象 key |
| `prefix` | 否 | `live/` | 上传文件名前缀 |
| `category` | 否 | `live` | `prefix` 未提供时作为目录，同时写入 custom metadata |
| `source` | 否 | `iptv-picker` | 写入 custom metadata |
| `customMetadata` | 否 | `{"env":"prod"}` | JSON 对象，会合并到 custom metadata |
| `httpMetadata` | 否 | `{"cacheControl":"public, max-age=300"}` | JSON 对象，应用到上传文件 |
| `publicAccess` | 否 | `public` | 可选值：`public`、`private`、`inherit` |

响应示例：

```json
{
  "success": true,
  "data": {
    "uploaded": [
      {
        "key": "live/iptv.m3u",
        "size": 12345,
        "contentType": "application/vnd.apple.mpegurl"
      }
    ],
    "failed": []
  }
}
```

### 创建文件夹

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"path":"folder/subfolder/"}' \
  "${BASE_URL}/api/folder"
```

### 删除文件

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"path":"folder/demo.txt"}' \
  "${BASE_URL}/api/delete"
```

### 移动或重命名

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"from":"folder/demo.txt","to":"folder/renamed.txt"}' \
  "${BASE_URL}/api/move"
```

### 复制文件

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"from":"folder/demo.txt","to":"folder/copy.txt"}' \
  "${BASE_URL}/api/copy"
```

### 更新 metadata

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"path":"folder/demo.txt","httpMetadata":{"contentType":"text/plain"},"customMetadata":{"source":"api"}}' \
  "${BASE_URL}/api/metadata"
```

### 公开访问控制

检查有效公开状态：

```bash
curl "${BASE_URL}/api/public-access?path=22.txt&token=${API_TOKEN}"
```

设置公开状态：

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"path":"22.txt","access":"public"}' \
  "${BASE_URL}/api/public-access"
```

`access` 可选值：

```text
public
private
inherit
```

设置 `22.txt` 为公开后，可以直接访问：

```text
https://your-domain.example/22.txt
https://iptv.303066.xyz/22.txt
```

### 分享链接

创建分享链接：

```bash
curl -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"path":"folder/demo.txt","expiresIn":86400,"password":"secret123","maxDownloads":3}' \
  "${BASE_URL}/api/share"
```

列出分享链接：

```bash
curl "${BASE_URL}/api/shares?token=${API_TOKEN}"
```

撤销分享链接：

```bash
curl -X DELETE \
  -H "Authorization: Bearer ${API_TOKEN}" \
  "${BASE_URL}/api/share?id=abc123def0"
```

### 旧 API 兼容

为了 Dashboard 和已有集成兼容，旧 API 仍然可用：

```text
/api/buckets/:bucket
/api/buckets/:bucket/upload
/api/buckets/:bucket/:key
```

新的脚本或外部集成建议优先使用：

```text
/api/list
/api/file
/api/upload
/api/folder
/api/delete
/api/move
/api/copy
/api/metadata
/api/public-access
/api/share
/api/shares
```

## 公开 R2 对象 URL

该 Worker 可以将被标记为公开的 R2 对象直接暴露到自定义域名根路径。例如 R2 中的对象 `22.txt` 可以访问：

```text
https://your-domain.example/22.txt
```

公开访问规则：

- 默认私有。
- 只有文件或父级目录被标记为公开时，根路径才会返回对象。
- 目录规则会按前缀继承到子文件和子目录。
- 子文件规则可以覆盖父目录规则。
- 公开链接只支持 `GET` 和 `HEAD`，不允许上传、删除、重命名或改 metadata。
- 如果对象不存在、不是公开状态或路径与保留路由冲突，会回退到 Dashboard/Assets 路由或返回 404。

公开访问规则保存在 R2：

```text
.r2-explorer/permissions/public-rules.json
```

## 保留根路径

以下根路径被 Dashboard、API、静态资源或分享链接占用，不建议作为公开对象根路径：

```text
admin
admin/...
auth/...
api/...
assets/...
icons/...
favicon.ico
logo-white.svg
```

示例：

- `admin.txt` 可以作为 `/admin.txt` 访问。
- `admin` 会与后台入口 `/admin` 冲突。
- `admin/...` 会与后台路由冲突。

这些文件仍可通过 Dashboard、鉴权 API 或分享链接访问。

## 链接类型对比

| 链接类型 | 示例 | 是否需要登录或 token | 权限 | 说明 |
| --- | --- | --- | --- | --- |
| 公开链接 | `/22.txt` | 否 | 公开只读 | 文件或父目录公开时可直接读取 R2 对象 |
| 私有链接 | `/R2/files`、`/api/buckets/R2/...` | 是 | Dashboard/API 权限 | 当前部署 `readonly=false`，鉴权用户可读写 |
| 分享链接 | `/share/<shareId>` | 一般不需要，可配置密码 | 受分享配置控制 | 可配置密码、过期时间、下载次数，可撤销 |

## 配置类型

Worker 可通过 `R2Explorer(config)` 配置：

```ts
type R2ExplorerConfig = {
  readonly?: boolean;
  cors?: boolean;
  cfAccessTeamName?: string;
  dashboardUrl?: string;
  publicBaseUrl?: string;
  defaultBucket?: string;
  apiToken?: string;
  adminToken?: string;
  emailRouting?: { targetBucket: string } | false;
  showHiddenFiles?: boolean;
  basicAuth?: BasicAuth | BasicAuth[];
  buckets?: Record<string, { publicUrl?: string }>;
};
```

## 常见问题

### 上传文件是否会直接进入 R2？

通过 Dashboard 或 `/api/upload` 上传时，请求先到 Cloudflare Worker，再由 Worker 使用 R2 binding 写入 R2。它不是浏览器直接调用 R2 S3 API，也不是上传到传统服务器磁盘后再同步。

### S3 和 R2 Worker 上传有什么区别？

- S3 API 通常由客户端直接向对象存储端点发请求，需要 Access Key、Secret、签名或预签名 URL。
- 当前 Worker API 由自定义域名接收请求，再通过 Cloudflare 内部 R2 binding 写入 bucket。
- Worker API 可以统一鉴权、路径规则、公开访问规则和业务参数，但请求仍需要经过 Worker。
- 大文件或高并发上传如需绕过 Worker，可额外设计 S3 兼容接口或预签名 URL 流程。

### 为什么 R2 bucket 配置后通常要重新部署？

Cloudflare Worker 的 R2 binding 属于 Worker 部署配置。新增、删除或改名 binding 后，需要通过 Wrangler 重新部署，让运行时拿到新的 binding。S3 客户端通常只需要 endpoint、bucket、access key 等运行时配置，因此很多情况下改配置即可，无需重新部署应用代码。

## 路线图

- 支持包含空格的 bucket 名称。
- 文件搜索。
- 文件夹重命名。
- 图片缩略图生成。
- Workers AI 对象检测。
- 更细致的时间提示。
- 邮件回复能力。
- 更多文件类型的专用编辑体验。

## 已知问题

- 使用 Basic Auth 时，邮件内联图片和部分资源可能无法正常加载。
- 更多问题请查看或提交到 [GitHub Issues](https://github.com/G4brym/R2-Explorer/issues)。

## 贡献

欢迎提交修复、功能或文档改进：

1. Fork 仓库。
2. 创建功能分支。
3. 提交 Pull Request。

## 许可证

本项目使用 MIT License，详情见 [LICENSE](LICENSE)。

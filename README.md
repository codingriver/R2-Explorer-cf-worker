<div align="center">
  <a href="https://r2explorer.com/">
    <img src="https://raw.githubusercontent.com/G4brym/R2-explorer/refs/heads/main/packages/docs/public/assets/r2-explorer-logo.png" width="500" height="auto" alt="R2-Explorer"/>
  </a>
</div>

<p align="center">
    <em>A Google Drive Interface for your Cloudflare R2 Buckets!</em>
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

R2-Explorer brings a familiar Google Drive-like interface to your Cloudflare R2 storage buckets, making file management simple and intuitive.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/r2-explorer-template)

## Quick Links

- 📚 **Documentation**: [r2explorer.com](https://r2explorer.com)
- 🎮 **Live Demo**: [demo.r2explorer.com](https://demo.r2explorer.com)
- 💻 **Source Code**: [github.com/G4brym/R2-Explorer](https://github.com/G4brym/R2-Explorer)

Available in multiple languages:
[English](https://r2explorer.com) |
[Español](https://r2explorer-com.translate.goog/?_x_tr_sl=en&_x_tr_tl=es) |
[Português](https://r2explorer-com.translate.goog/?_x_tr_sl=en&_x_tr_tl=pt-PT) |
[Français](https://r2explorer-com.translate.goog/?_x_tr_sl=en&_x_tr_tl=fr)

## Overview

R2-Explorer transforms your Cloudflare R2 storage experience with a modern, user-friendly interface. It provides powerful file management capabilities while maintaining enterprise-grade security through Cloudflare's infrastructure.

## Key Features

- **🔒 Security**
  - Basic Authentication support
  - Cloudflare Access integration
  - Self-hosted on your Cloudflare account

- **📁 File Management**
  - Drag-and-drop file upload
  - Folder creation and organization
  - Multi-part upload for large files
  - Right-click context menu for advanced options
  - HTTP/Custom metadata editing
  - **Sharable Links** - Create secure, public URLs for files with optional password protection, expiration times, and download limits

- **👀 File Handling**
  - In-browser file preview
    - PDF documents
    - Images
    - Text files
    - Markdown
    - CSV
    - Logpush files
  - In-browser file editing
  - Folder upload support

- **📧 Email Integration**
  - Receive and process emails via Cloudflare Email Routing
  - View email attachments directly in the interface

## Installation Methods

Choose the method that best suits your needs:

1. **GitHub Action (Recommended)**

   [Follow the guide here](https://r2explorer.com/getting-started/creating-a-new-project/#1st-method-github-action-recommended)

2. **Cloudflare CLI**

   [Follow the guide here](https://r2explorer.com/getting-started/creating-a-new-project/#2nd-method-create-cloudflare)

3. **Template Repository**

   [Use our template here](https://github.com/G4brym/R2-Explorer/tree/main/template)

For detailed instructions on maintaining and updating your installation, visit our [update guide](https://r2explorer.com/getting-started/updating-your-project/).

## Deployment Notes / 特别注意

This customized Worker can read the admin credentials and API token from Cloudflare Worker environment variables or secrets. Configure them before production use.

### Admin Login

- Admin URL: `/admin`
- Unauthenticated visits to `/admin` redirect to `/auth/login?next=/admin`
- After login, the dashboard opens the first R2 bucket, for example `/R2/files`

Default fallback credentials, used only when the matching environment variables/secrets are not set:

| Setting | Environment variable | Default value |
| --- | --- | --- |
| Admin username | `BASIC_AUTH_USERNAME` | `admin` |
| Admin password | `BASIC_AUTH_PASSWORD` | `codingriver` |
| API token | `API_TOKEN` | `codingriver` |

For a production deployment, set your own values in Cloudflare Worker variables/secrets. Do not commit real passwords or API tokens to Git.

For security, replace the defaults in your own deployment:

```bash
wrangler secret put BASIC_AUTH_PASSWORD
wrangler secret put API_TOKEN
```

`BASIC_AUTH_USERNAME` can be configured as a normal Worker variable, or as a secret if you prefer.

### Git and Secret Safety

Do not commit deployment-specific secrets or local Cloudflare state.

- Commit example or generic config files only.
- Keep real Worker config such as `packages/worker/dev/wrangler.toml` local.
- Keep `.env`, `.dev.vars`, `.wrangler/`, build outputs, and `node_modules/` out of Git.
- Store real `BASIC_AUTH_PASSWORD` and `API_TOKEN` values with `wrangler secret put`.
- Use placeholders such as `your-domain.example`, `your-password`, and `your-api-token` in documentation.

### API Access

Direct API requests are protected. A request such as `/api/server/config` without credentials returns:

```text
Authentication error: Basic Auth required
```

This is expected. Use either Basic Auth:

```bash
curl -u "admin:your-password" https://your-domain.example/api/server/config
```

Or use the API token:

```bash
curl -H "x-api-key: your-api-token" https://your-domain.example/api/server/config
```

`Authorization: Bearer <token>` is also supported.

### Public R2 Object URLs

This Worker can expose selected R2 objects directly from the custom domain. For example, an R2 object named `22.txt` can be opened at:

```text
https://your-domain.example/22.txt
```

Public root-path access is controlled from each file/folder row switch or from the dashboard context menu:

- `Make Public` allows direct public URL access
- `Make Private` blocks direct public URL access
- `Inherit Parent Access` removes the item rule and uses the nearest folder rule

Folder rules apply to all child files and child folders by prefix inheritance. A child file can still override the folder rule with its own `Make Public` or `Make Private` setting.

By default, objects are private for root-path public access. If an object is not public, does not exist, or conflicts with a reserved path, the request falls back to the dashboard/assets routes or returns 404.

Public access rules are stored in R2 at:

```text
.r2-explorer/permissions/public-rules.json
```

### Reserved Root Paths

Some root paths are reserved for the dashboard, API, static assets, and share links. Avoid using these exact names or prefixes for public root-level R2 object URLs:

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

For example:

- `admin.txt` is safe and can be opened as `/admin.txt`
- `admin` conflicts with the dashboard entry `/admin`
- `admin/...` conflicts with dashboard routes

Files with reserved names can still be managed from the dashboard, downloaded through authenticated API routes, or shared with generated share links.

### Link Types and Permissions

The current deployment supports three different link types. They are all still valid, but they have different permission rules.

| Link type | Example | Requires login/token | Access level | Notes |
| --- | --- | --- | --- | --- |
| Public Link | `/22.txt` | No | Public read-only object access | Reads an R2 object directly from the root path only when the file or a parent folder is marked public. Supports `GET`/`HEAD`; it does not allow upload, delete, rename, or metadata changes. |
| Private Link | `/R2/files`, `/api/buckets/R2/...` | Yes | Dashboard/API access | Requires Basic Auth or API token. In this deployment `readonly` is `false`, so authenticated users can upload, create folders, edit metadata, rename, copy, delete, and create share links. |
| Share Link | `/share/<shareId>` | No, unless a share password is configured | Controlled public file access | Generated from the dashboard. Can include password protection, expiration time, and max download count. Can be revoked from the dashboard. |

#### Public Link

Public links are direct root-path object URLs for files that have been marked public. For example:

```text
https://your-domain.example/22.txt
```

Permission behavior:

- Does not require dashboard login
- Default is private
- Only returns an object if that exact key exists in R2 and effective public access is `public`
- Folder public/private rules apply to child paths by inheritance
- File rules override folder rules
- Does not expose bucket listing
- Does not allow write operations
- Conflicts with reserved root paths listed above

#### Private Link

Private links are dashboard pages or API endpoints that require authentication. Examples:

```text
https://your-domain.example/admin
https://your-domain.example/R2/files
https://your-domain.example/api/buckets/R2
```

Permission behavior:

- `/admin` redirects unauthenticated users to the login page
- `/api/*` returns `401` unless Basic Auth or API token is provided
- Basic Auth uses `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`
- API token uses `API_TOKEN` via `x-api-key` or `Authorization: Bearer <token>`
- Current deployment has `readonly: false`, so authenticated access is read/write

#### Share Link

Share links are generated links managed by R2-Explorer:

```text
https://your-domain.example/share/<shareId>
```

Permission behavior:

- Does not require dashboard login
- Can require a share password if configured
- Can expire if an expiration time is configured
- Can stop working after the max download count is reached
- Can be revoked by deleting the share from the dashboard
- Share metadata is stored in R2 under `.r2-explorer/sharable-links/`
- Share links are separate from Public Links and do not depend on the object name being safe for root-path access

## Roadmap

We're actively working on these exciting features:

- **File Management**
  - Support for bucket names with spaces
  - File search functionality
  - Folder renaming capability
  - Image thumbnails generation

- **AI Integration**
  - Object detection using workers-ai

- **User Experience**
  - Enhanced timestamp tooltips
  - Email response capabilities
  - Advanced file type-specific editing

## Known Issues

- When using basic authentication, email inline images and assets don't load properly
- Additional issues can be found and reported on our [GitHub Issues](https://github.com/G4brym/R2-Explorer/issues) page

## Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation improvements, please feel free to:

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## Support

- 📚 Documentation: [r2explorer.com](https://r2explorer.com)
- 🐛 Issue Tracker: [GitHub Issues](https://github.com/G4brym/R2-Explorer/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

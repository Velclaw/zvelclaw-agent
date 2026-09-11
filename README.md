# Zvelclaw

## Test trang hiện tại

**[MỞ ZVELCLAW TEST PREVIEW →](https://velclaw.github.io/zvelclaw-agent/)**

Đây là trang test UI hiện tại của Zvelclaw trên GitHub Pages.

- **Test Preview:** https://velclaw.github.io/zvelclaw-agent/
- **Production:** https://velclaw.cfd
- **Repository:** https://github.com/Velclaw/zvelclaw-agent

> Lưu ý: GitHub Pages là bản preview tĩnh để kiểm tra giao diện. Các API/server route của Next.js không chạy trên GitHub Pages.

## Zvelclaw IDE

Zvelclaw là AI coding IDE với workflow:

**Understand → Plan → Review → Apply → Build → Fix**

Repo hiện chứa giao diện IDE, repository integration, AI agent route, isolated branches, apply/build workflow và GitHub Pages preview.

## Test nhanh

1. Mở **[Zvelclaw Test Preview](https://velclaw.github.io/zvelclaw-agent/)**.
2. Kiểm tra giao diện landing/IDE preview.
3. Nút **Open Production IDE** dẫn tới `https://velclaw.cfd`.
4. Khi cần xem mã nguồn, quay lại repository này.

## Local development

Install dependencies and start the Next.js development server:

```bash
pnpm install
pnpm dev
```

## Build verification

```bash
pnpm exec tsc --noEmit -p tsconfig.json
pnpm build
```

## GitHub Pages

The static preview is deployed from `pages/` by `.github/workflows/github-pages.yml`.

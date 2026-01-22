# 5hon.com

GoogleドキュメントからApple Books向け**縦書きEPUB3**を生成する無料Webアプリ。

> A free web app to generate vertical-writing EPUB3 for Apple Books from Google Docs.

## Quick Start

```bash
npm install
npm run dev
```

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Cloudflare Pages Functions
- **EPUB生成**: JSZip（手動EPUB3構造）

## Features (MVP)

- ✅ 公開Googleドキュメントから縦書きEPUB生成
- ✅ ルビ記法（`｜漢字《かんじ》`）
- ✅ 縦中横（数字/英字のON/OFF）
- ✅ 表紙アップロード
- ✅ Apple Books最適化

## License

MIT

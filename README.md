# 5hon.com

**Googleドキュメントから、iPhone/iPad「ブック（Apple Books）」で心地よく読める縦書きEPUBを生成する無料Webツール。**

> Generate vertical-writing EPUB3 optimized for Apple Books from Google Docs.

![Status](https://img.shields.io/badge/Status-Beta-green)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📖 コンセプト

「5hon.com」は、iPhoneを持っている友人に、自分の小説やエッセイを**「まるで売り物の本のような形（縦書き・表紙付き）」で手渡したい（ZINEを作りたい）**というニーズに応えるために開発されたツールです。

難しい設定や登録は一切不要。GoogleドキュメントのURLを貼るだけで、AirDropで配れる`.epub`ファイルが一瞬で完成します。

## 🚀 特徴

### 1. Googleドキュメント特化
インプットを**「公開共有されたGoogleドキュメント」**に絞ることで、もっとも手軽なフローを実現しました。
WordやMarkdownファイルのアップロードは不要です。ブラウザで執筆して、そのままURLを貼るだけです。

### 2. Apple Books（iPhone/iPad）完全最適化
汎用的なEPUBではなく、**Apple Booksでの表示の美しさ**にフォーカスして調整されています。
*   **美しい縦書き**: 日本語特有の禁則処理や段落スタイルを適用
*   **ルビ対応**: `｜漢字《かんじ》` 記法で正確にルビを振ることができます
*   **縦中横**: 「2024年」などの数字や、「EPUB」などの短い英単語を自動で縦書き用に正立させます

### 3. プライバシー・ファースト
*   ユーザー登録不要
*   サーバーに原稿データを保存しません（オンザフライ変換）
*   生成されたEPUBファイルのログも保持しません

---

## 🛠 将来のロードマップ

現在は「iPhoneユーザーが手軽にZINEを作る」ことに特化していますが、将来的にはより広い用途に対応していく予定です。

*   **Google Play Books対応**: Androidユーザー向けリーダーでの表示最適化
*   **Kindle (KDP) 入稿対応**: Amazonでのセルフパブリッシングに耐えうる厳密な仕様への準拠
*   **非公開ドキュメント対応**: OAuth認証によるプライベートな原稿の変換

---

## 💻 技術スタック

*   **Framework**: [Astro](https://astro.build) (Static Site Generation + Server-side Rendering)
*   **Language**: TypeScript
*   **Hosting**: Cloudflare Pages
*   **Core Logic**: JSZip (EPUB3 Packaging), Cloudflare Workers (Edge Computing)

## 開発者向け

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
npm run build
```

---

## License

MIT License

&copy; 2026 5hon.com

# 5hon.com

**Googleドキュメントから、iPhone/iPad「ブック（Apple Books）」で心地よく読める縦書きEPUBを生成する無料Webツール。**

> Generate vertical-writing EPUB3 optimized for Apple Books from Google Docs.

![Status](https://img.shields.io/badge/Status-Beta-green)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📖 コンセプト

「5hon.com」は、iPhoneを持っている友人に、自分の小説やエッセイを「**縦書き・表紙付き**」で手渡したい（ZINEを作りたい）というニーズに応えるために開発されたツールです。

難しい設定や登録は一切不要。GoogleドキュメントのURLを貼るだけで、AirDropで配れる`.epub`ファイルが一瞬で完成します。

## 🚀 特徴

### 1. Googleドキュメント特化
インプットを「**公開共有されたGoogleドキュメント**」に絞ることで、もっとも手軽なフローを実現しました。
WordやMarkdownファイルのアップロードは不要です。ブラウザで執筆して、そのままURLを貼るだけです。

### 2. Apple Books（iPhone/iPad）完全最適化
汎用的なEPUBではなく、**Apple Booksでの表示の美しさ**にフォーカスして調整されています。
*   **美しい縦書き**: 日本語特有の禁則処理や段落スタイルを適用
*   **ルビ対応**: `｜漢字《かんじ》` 記法で正確にルビを振ることができます
*   **縦中横**: 「1984年」などの数字や、「EPUB」などの短い英単語を自動で縦書き用に正立させます

### 3. プライバシー・ファースト
*   ユーザー登録不要
*   サーバーに原稿データを保存しません（オンザフライ変換）
*   生成されたEPUBファイルのログも保持しません

### 4. 改ページ対応
*   Googleドキュメント上で挿入した**改ページ**がEPUBにも反映されます
*   章の区切りなど、任意の位置でページを分けることができます

---

## 📝 更新履歴

*   **2026-02-02**: Googleドキュメントの改ページをEPUBに反映する機能を追加

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

## 技術的な詳細 (Technical Details)

### 1. 原稿の正規化処理 (Text Normalization)
5hon.comでは、Googleドキュメントから取得したHTMLに対し、電子書籍リーダーでの表示を最適化するために以下の処理を行っています。

*   **スタイルの完全除去**: Googleドキュメント上で設定された文字色、フォントサイズ、太字、斜体などの装飾はすべて削除され、プレーンテキストとして抽出されます。これにより、リーダー側の設定（夜間モードやフォント変更）が正しく機能します。
*   **字下げ（インデント）の自動調整**:
    *   **手動スペースの削除**: 原稿の行頭にある空白（全角・半角スペース）はすべて自動的に削除 (`trim`) されます。
    *   **CSSによる一括字下げ**: EPUBのCSS (`text-indent: 1em`) により、すべての段落の先頭に自動的に一文字分の字下げが付与されます。これにより「手動で入れたスペース＋自動インデント」で字下げが二重になり、行頭がガタガタになる現象を防いでいます。
    *   **会話文の字下げ抑制**: 「『（【 などの括弧類で始まる段落は、日本独特の組版ルールに従い、特例として字下げを行わない (`.no-indent`) 処理を自動適用しています。

### 2. 縦書き対応 (Vertical Formatting)
*   `writing-mode: vertical-rl` をベースに、長音記号や括弧の向きを縦書き用に最適化しています。
*   **縦中横 (Tate-Chu-Yoko)**: 2桁〜4桁の半角数字、およびオプションで短い英単語（"EPUB"など）を自動検出し、`text-combine-upright` を適用して縦書きの中で正立させます。

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

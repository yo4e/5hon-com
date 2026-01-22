import { useState } from 'react'
import './index.css'

interface GenerateOptions {
  tcyNumbers: boolean
  tcyLatin: boolean
  tocPage: boolean
}

function App() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [publicationDate, setPublicationDate] = useState('') // 出版年月日（任意）
  const [publisher, setPublisher] = useState('') // 出版社名（任意）
  const [issuer, setIssuer] = useState('') // 発行者（任意）
  const [colophonNotes, setColophonNotes] = useState('') // 奥付自由記入（任意）
  const [options, setOptions] = useState<GenerateOptions>({
    tcyNumbers: true,  // デフォルトON
    tcyLatin: false,   // デフォルトOFF
    tocPage: true,     // デフォルトON
  })
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadFilename, setDownloadFilename] = useState<string>('output.epub')
  const [error, setError] = useState<string | null>(null)
  const [accordionOpen, setAccordionOpen] = useState(false) // 使い方アコーディオン

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('画像サイズは5MB以下にしてください')
        return
      }
      setCoverFile(file)

      const reader = new FileReader()
      reader.onload = (ev) => {
        setCoverPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleGenerate = async () => {
    if (!url) {
      setError('URLを入力してください')
      return
    }

    // バリデーション: Google DocsのURLかチェック
    if (!url.includes('docs.google.com/document/d/')) {
      setError('有効なGoogleドキュメントのURLではありません')
      return
    }

    setIsGenerating(true)
    setError(null)
    setDownloadUrl(null)

    try {
      // 表紙画像をBase64に変換
      let coverBase64: string | undefined
      let coverType: 'jpeg' | 'png' | undefined

      if (coverFile) {
        coverBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            // data:image/jpeg;base64,..... を除去してデータ部のみ渡す
            resolve(result.split(',')[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(coverFile)
        })
        coverType = coverFile.type === 'image/png' ? 'png' : 'jpeg'
      }

      // API呼び出し
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          title: title.trim(),
          author: author.trim(),
          publicationDate: publicationDate.trim(),
          publisher: publisher.trim(),
          issuer: issuer.trim(),
          colophonNotes: colophonNotes.trim(),
          options,
          coverBase64,
          coverType,
        }),
      })

      if (!response.ok) {
        let message = 'EPUB生成に失敗しました'
        const rawText = await response.text()
        if (rawText) {
          try {
            const errorData = JSON.parse(rawText) as { message?: string }
            message = errorData.message || message
          } catch {
            message = rawText
          }
        }
        throw new Error(message)
      }

      // Blobとして取得してダウンロードURLを生成
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      setDownloadUrl(downloadUrl)

      // ダウンロードファイル名の生成
      const now = new Date()
      // YYYYMMDD_HHMMSS 形式
      const timestamp = now.getFullYear() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') + '_' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0')
      const safeTitle = (title || 'output').replace(/[\\/:*?"<>|]/g, '_')
      setDownloadFilename(`${safeTitle}_${timestamp}.epub`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'EPUB生成に失敗しました。URLを確認してやり直してください。')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <h1>5hon.com</h1>
        <p className="header-sub">
          GoogleドキュメントからiPhone/Mac向け縦書きEPUBを生成
        </p>
        <div className="header-badges">
          <span className="badge">縦書きEPUB3</span>
          <span className="badge">ユーザー登録不要・無料</span>
          <span className="badge">iPhone/Mac対応</span>
        </div>
      </header>

      {/* Two Column Layout */}
      <div className="two-column">
        {/* Main Column */}
        <main>
          {/* URL Input */}
          <div className="card">
            <div className="input-group">
              <label className="input-label" htmlFor="doc-url">
                Googleドキュメントの共有リンク
              </label>
              <input
                id="doc-url"
                type="url"
                className="input-text"
                placeholder="https://docs.google.com/document/d/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            {/* Metadata (New) */}
            <div className="input-group">
              <label className="input-label">書誌情報（任意）</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="タイトル（例：吾輩は猫である）"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="著者名（例：夏目 漱石）"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 奥付情報（任意） */}
            <div className="input-group">
              <label className="input-label">奥付情報（任意）</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="発行者（例：5hon編集部）"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="発行日（例：2025年01月21日）"
                    value={publicationDate}
                    onChange={(e) => setPublicationDate(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="発行（例：5hon出版）"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <textarea
                  className="input-text"
                  rows={4}
                  placeholder="奥付への自由記入（例：印刷所や連絡先など）"
                  value={colophonNotes}
                  onChange={(e) => setColophonNotes(e.target.value)}
                />
              </div>

              {/* Options */}
              <div className="input-group">
                <label className="input-label">オプション</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <span>数字を縦中横に</span>
                    <input
                      type="checkbox"
                      checked={options.tcyNumbers}
                      onChange={(e) => setOptions({ ...options, tcyNumbers: e.target.checked })}
                    />
                  </label>
                  <label className="checkbox-label">
                    <span>英字を縦中横に</span>
                    <input
                      type="checkbox"
                      checked={options.tcyLatin}
                      onChange={(e) => setOptions({ ...options, tcyLatin: e.target.checked })}
                    />
                  </label>
                  <label className="checkbox-label">
                    <span>目次ページを生成</span>
                    <input
                      type="checkbox"
                      checked={options.tocPage}
                      onChange={(e) => setOptions({ ...options, tocPage: e.target.checked })}
                    />
                  </label>
                </div>
              </div>

              {/* Cover Upload */}
              <div className="input-group">
                <label className="input-label">表紙画像（任意）</label>
                <label className="file-upload">
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleCoverChange}
                    style={{ display: 'none' }}
                  />
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="表紙プレビュー"
                      style={{ maxWidth: '150px', maxHeight: '200px', borderRadius: '4px' }}
                    />
                  ) : (
                    <>
                      <div className="file-upload-icon">+</div>
                      <div className="file-upload-text">
                        クリックして表紙画像を選択
                      </div>
                      <div className="file-upload-hint">
                        JPEG / PNG・5MB以下・長辺1600px以上推奨
                      </div>
                    </>
                  )}
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="message message-error">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <span className="loading-spinner"></span>
                      生成中...
                    </>
                  ) : (
                    'EPUB生成'
                  )}
                </button>

                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={downloadFilename}
                    className="btn btn-success"
                  >
                    ダウンロード
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Preview removed */}
        </main>

        {/* Sidebar */}
        <aside className="sidebar">
          {/* Spotify Embed - 広告枠を上に */}
          <div className="card" style={{ padding: '0.5rem', overflow: 'hidden' }}>
            <div className="spotify-embed-container">
              <iframe
                style={{ borderRadius: '12px' }}
                src="https://open.spotify.com/embed/album/6RkKzmALX0QTDV2FddLsHB?utm_source=generator"
                width="100%"
                height="352"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                title="Spotify Album"
              ></iframe>
              <div className="pr-text">PR: 読書にぴったりのアンビエントミュージック</div>
            </div>
          </div>

          {/* How to Use */}
          <div className="accordion">
            <button
              className="accordion-header"
              onClick={() => setAccordionOpen(!accordionOpen)}
            >
              <span>使い方</span>
              <span className={`accordion-icon ${accordionOpen ? 'open' : ''}`}>▼</span>
            </button>
            {accordionOpen && (
              <div className="accordion-content">
                <ol>
                  <li>Googleドキュメントを<strong>「リンクを知っている全員が閲覧可」</strong>に設定</li>
                  <li>共有リンクを上の入力欄に貼り付け</li>
                  <li>必要に応じて表紙画像をアップロード</li>
                  <li>「EPUB生成」ボタンをクリック</li>
                  <li>ダウンロードしてApple Booksで開く</li>
                </ol>
                <div style={{ marginTop: '1rem' }}>
                  <p><strong>ルビの書き方：</strong><br />
                    <code>｜漢字《かんじ》</code> と書くとルビが付きます</p>
                  <p style={{ marginTop: '0.5rem' }}><strong>縦中横（たてちゅうよこ）とは？：</strong><br />
                    縦書きの中で、数字や英字を横書きのまま表示する機能です。「30」や「EPUB」などの短い文字列に便利です。</p>
                  <p style={{ marginTop: '0.5rem' }}><strong>縦中横は4文字まで：</strong><br />
                    <code>2024</code> や <code>EPUB</code> など最大4文字まで縦中横になります。</p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9em', color: '#666' }}>
                    ※ドキュメント内の画像や文字の装飾（色・太字など）は反映されません。
                  </p>
                  <p style={{ marginTop: '1rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem', fontSize: '0.9em' }}>
                    <strong>推奨環境：</strong><br />
                    iPhone / iPad / Mac の「Apple Books」または「ブック」アプリ。<br />
                    ※ブラウザは <strong>Safari</strong> または <strong>Chrome</strong> を推奨します。Googleアプリなどの内蔵ブラウザではダウンロードがうまくいかない場合があります。<br />
                    ※iPhoneの場合、ダウンロードしたファイルは「ファイル」アプリの「ダウンロード」フォルダに保存されます。
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer style={{
        marginTop: '3rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--color-border)',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.8rem'
      }}>
        <p>
          &copy; 2026 5hon.com
        </p>
      </footer>
    </div>
  )
}

export default App

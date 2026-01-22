import type { APIRoute } from 'astro';
import JSZip from 'jszip';

interface RequestBody {
    url: string
    title?: string
    author?: string
    publicationDate?: string
    publisher?: string
    issuer?: string
    edition?: string
    colophonNotes?: string
    options: {
        tcyNumbers: boolean
        tcyLatin: boolean
        tocPage?: boolean
    }
    coverBase64?: string
    coverType?: 'jpeg' | 'png'
}

interface ContentNode {
    type: 'p' | 'h1' | 'h2' | 'h3'
    text: string
    isBlank?: boolean
    noIndent?: boolean
}

// ========== Google Docs取得 ==========

function extractDocId(url: string): string | null {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
}

async function fetchGoogleDocHtml(docId: string): Promise<{
    success: boolean
    html?: string
    title?: string
    error?: string
    errorCode?: string
}> {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`

    try {
        const response = await fetch(exportUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; 5hon.com EPUB Generator)',
            },
        })

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    error: 'このドキュメントは非公開の可能性があります。「リンクを知っている全員が閲覧可」に設定してください。',
                    errorCode: 'NOT_PUBLIC',
                }
            }
            return {
                success: false,
                error: `ドキュメントの取得に失敗しました（${response.status}）`,
                errorCode: 'FETCH_FAILED',
            }
        }

        const html = await response.text()

        if (html.includes('accounts.google.com') || html.includes('ServiceLogin')) {
            return {
                success: false,
                error: 'このドキュメントは非公開の可能性があります。「リンクを知っている全員が閲覧可」に設定してください。',
                errorCode: 'NOT_PUBLIC',
            }
        }

        const titleMatch = html.match(/<title>([^<]+)<\/title>/)
        const title = titleMatch ? titleMatch[1].replace(/ - Google ドキュメント$/, '').trim() : 'Untitled'

        return { success: true, html, title }
    } catch (error) {
        return {
            success: false,
            error: `ネットワークエラー: ${error instanceof Error ? error.message : 'Unknown'}`,
            errorCode: 'FETCH_FAILED',
        }
    }
}

// ========== HTML解析 ==========

function parseGoogleDocHtml(html: string, title: string): { title: string; paragraphs: ContentNode[] } {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyContent = bodyMatch ? bodyMatch[1] : html

    const cleaned = bodyContent
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

    const paragraphs: ContentNode[] = []

    // 見出しと段落を順番に抽出
    const tagRegex = /<(h1|h2|h3|p)[^>]*>([\s\S]*?)<\/\1>/gi
    let match
    while ((match = tagRegex.exec(cleaned)) !== null) {
        const type = match[1].toLowerCase() as ContentNode['type']
        const raw = match[2]
        const text = stripHtml(raw)
        if (text.trim()) {
            paragraphs.push({ type, text: text.trim() })
        } else if (type === 'p' && isBlankParagraph(raw)) {
            paragraphs.push({ type, text: '', isBlank: true })
        }
    }

    return { title: sanitizeText(title), paragraphs }
}

function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        // 名前付きHTMLエンティティをデコード
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&mdash;/g, '\u2014')
        .replace(/&ndash;/g, '\u2013')
        .replace(/&hellip;/g, '\u2026')
        .replace(/&lsquo;/g, '\u2018')
        .replace(/&rsquo;/g, '\u2019')
        .replace(/&ldquo;/g, '\u201C')
        .replace(/&rdquo;/g, '\u201D')
        .replace(/&copy;/g, '\u00A9')
        .replace(/&reg;/g, '\u00AE')
        .replace(/&trade;/g, '\u2122')
        .replace(/&times;/g, '\u00D7')
        .replace(/&divide;/g, '\u00F7')
        // 数値文字参照をデコード（&#12345; 形式）
        .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
        // 16進数文字参照をデコード（&#x3042; 形式）
        .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
        .trim()
}

function isBlankParagraph(html: string): boolean {
    if (html.trim() === '') return true
    if (/<br\s*\/?>|&nbsp;|\u00a0/i.test(html)) return true
    if (/class=(\"|')[^\"']*\bc3\b[^\"']*(\"|')/i.test(html)) return true
    if (/<span[^>]*>\s*<\/span>/i.test(html)) return true
    return false
}

// ========== ルビ変換 ==========

function convertRuby(text: string): string {
    return text.replace(/｜([^《]+)《([^》]+)》/g, (_m, base, ruby) => {
        return `<ruby>${base}<rt>${ruby}</rt></ruby>`
    })
}

// ルビ記法を除去して親文字だけにする（目次用）
function stripRubyNotation(text: string): string {
    return text.replace(/｜([^《]+)《[^》]+》/g, '$1')
}

function shouldNoIndent(text: string): boolean {
    const normalized = stripRubyNotation(text).trimStart()
    return /^[「『（【［〔〈《“‘]/.test(normalized)
}

// ========== 縦中横変換 ==========

function convertTcy(text: string, options: { numbers: boolean; latin: boolean }): string {
    let result = text

    if (options.numbers) {
        result = applyTcyOutsideRuby(result, /[0-9]{1,4}/g)
    }
    if (options.latin) {
        result = applyTcyOutsideRuby(result, /[A-Za-z!?.,:;@#$%&+*=/\\-]{1,4}/g)
    }

    return result
}

function applyTcyOutsideRuby(text: string, pattern: RegExp): string {
    const parts: { text: string; isTag: boolean; inRuby: boolean }[] = []
    const tagPattern = /<[^>]+>/g
    let lastIndex = 0
    let inRuby = false
    let inRt = false
    let match

    while ((match = tagPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ text: text.substring(lastIndex, match.index), isTag: false, inRuby: inRuby || inRt })
        }
        const tagNameMatch = match[0].match(/^<\/?([a-zA-Z0-9]+)/)
        const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : ''
        if (tagName === 'ruby') inRuby = !match[0].startsWith('</')
        else if (tagName === 'rt') inRt = !match[0].startsWith('</')
        parts.push({ text: match[0], isTag: true, inRuby: false })
        lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
        parts.push({ text: text.substring(lastIndex), isTag: false, inRuby: inRuby || inRt })
    }

    return parts.map((p) => {
        if (p.isTag || p.inRuby) return p.text

        // 実体参照を保護（プレースホルダーに一時置換）
        const entities: string[] = []
        const protectedText = p.text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
            entities.push(entity)
            const index = entities.length - 1
            // インデックスを全角数字に変換してTCY（半角数字のみ対象）の誤爆を防ぐ
            const fullWidthIndex = index.toString().replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xFEE0))
            return `\uE000${fullWidthIndex}\uE000`
        })

        // TCY変換適用
        const converted = protectedText.replace(pattern, (m) => `<span class="tcy">${m}</span>`)

        // 実体参照を復元
        return converted.replace(/\uE000([０-９]+)\uE000/g, (_, fullWidthIndex) => {
            const index = parseInt(fullWidthIndex.replace(/[０-９]/g, (d: string) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)), 10)
            return entities[index]
        })
    }).join('')
}

// ========== EPUB生成 ==========

async function buildEpub(
    paragraphs: ContentNode[],
    options: {
        title: string
        author?: string
        publicationDate?: string
        publisher?: string
        issuer?: string
        edition?: string
        colophonNotes?: string
        identifier: string
        tcyNumbers: boolean
        tcyLatin: boolean
        tocPage: boolean
        coverImage?: { data: ArrayBuffer; type: 'jpeg' | 'png' }
    }
): Promise<Uint8Array> {
    const zip = new JSZip()

    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

    // まずテキストをエスケープしてからルビ・縦中横変換
    const processed = paragraphs.map((p) => {
        if (p.isBlank) {
            return { ...p, text: '<br/>', noIndent: false }
        }
        const escaped = escapeXml(p.text)
        const withRubyAndTcy = convertTcy(convertRuby(escaped), { numbers: options.tcyNumbers, latin: options.tcyLatin })
        return { ...p, text: withRubyAndTcy, noIndent: p.type === 'p' && shouldNoIndent(p.text) }
    })

    // 目次はエスケープ前のテキストから生成（ルビ記法は除去）
    const toc = paragraphs
        .filter((p) => p.type === 'h1' || p.type === 'h2' || p.type === 'h3')
        .map((p, i) => ({
            id: `toc-${i}`,
            text: stripRubyNotation(p.text),
            level: p.type === 'h1' ? 1 : p.type === 'h2' ? 2 : 3
        }))
    const tocRich = processed
        .filter((p) => p.type === 'h1' || p.type === 'h2' || p.type === 'h3')
        .map((p, i) => ({
            id: `toc-${i}`,
            text: p.text
        }))

    const hasCover = !!options.coverImage
    const hasColophon = !!(options.publicationDate || options.publisher || options.issuer || options.edition || options.colophonNotes)
    const hasTocPage = options.tocPage !== false
    const coverExt = options.coverImage?.type === 'jpeg' ? 'jpg' : 'png'
    const coverMediaType = options.coverImage?.type === 'jpeg' ? 'image/jpeg' : 'image/png'

    // content.opf
    zip.file('OEBPS/content.opf', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(options.identifier)}</dc:identifier>
    <dc:title>${escapeXml(options.title)}</dc:title>
    ${options.author ? `<dc:creator id="creator">${escapeXml(options.author)}</dc:creator>` : ''}
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="titlepage" href="title.xhtml" media-type="application/xhtml+xml"/>
    ${hasTocPage ? '<item id="tocpage" href="toc.xhtml" media-type="application/xhtml+xml"/>' : ''}
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    ${hasColophon ? '<item id="colophon" href="colophon.xhtml" media-type="application/xhtml+xml"/>' : ''}
    <item id="backmatter" href="backmatter.xhtml" media-type="application/xhtml+xml"/>
    ${hasCover ? `<item id="cover-image" href="cover.${coverExt}" media-type="${coverMediaType}" properties="cover-image"/>` : ''}
  </manifest>
  <spine page-progression-direction="rtl">
    <itemref idref="cover"/>
    <itemref idref="titlepage"/>
    ${hasTocPage ? '<itemref idref="tocpage"/>' : ''}
    <itemref idref="content"/>
    ${hasColophon ? '<itemref idref="colophon"/>' : ''}
    <itemref idref="backmatter"/>
  </spine>
</package>`))

    // nav.xhtml
    const tocItems = toc.length > 0
        ? toc.map((t) => `      <li><a href="content.xhtml#${t.id}">${escapeXml(t.text)}</a></li>`).join('\n')
        : `      <li><a href="content.xhtml">${escapeXml(options.title)}</a></li>`
    const tocItemsRich = tocRich.length > 0
        ? tocRich.map((t) => `      <li><a href="content.xhtml#${t.id}">${t.text}</a></li>`).join('\n')
        : `      <li><a href="content.xhtml">${escapeXml(options.title)}</a></li>`

    zip.file('OEBPS/nav.xhtml', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja">
<head><meta charset="UTF-8"/><title>目次</title><link rel="stylesheet" href="style.css"/></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目次</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
</body>
</html>`))

    if (hasTocPage) {
        zip.file('OEBPS/toc.xhtml', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8"/><title>目次</title><link rel="stylesheet" href="style.css"/></head>
<body class="tocpage">
  <h1>目次</h1>
  <ol>
${tocItemsRich}
  </ol>
</body>
</html>`))
    }

    // style.css
    zip.file('OEBPS/style.css', `html{writing-mode:vertical-rl;-webkit-writing-mode:vertical-rl}
body{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:1em;line-height:1.8;margin:2em;text-align:justify}
h1{font-size:1.4em;font-weight:bold;margin:2em 1em 1em}
h2{font-size:1.3em;font-weight:bold;margin:1.5em 0.5em}
h3{font-size:1.1em;font-weight:bold;margin:1em 0.5em}
p{text-indent:1em;margin:0.5em 0}
p.blank{margin:0.5em 0;min-height:1em;text-indent:0}
p.no-indent{text-indent:0}
.titlepage{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;writing-mode:horizontal-tb;-webkit-writing-mode:horizontal-tb}
.titlepage .titlebox{border:1px solid #333;padding:1.6em 2.4em;width:62%;min-height:70%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.titlepage .title{font-size:1.4em;font-weight:600;margin:0 0 0.5em 0;line-height:1.5}
.titlepage .author{font-size:0.85em;margin:0}
.tocpage{margin:3em 2em}
.tocpage ol{list-style:none;padding:0;margin:0}
.tocpage li{margin:0 0 0.8em 0}
.colophon-page{writing-mode:horizontal-tb;-webkit-writing-mode:horizontal-tb;display:flex;align-items:flex-end;justify-content:center;height:100vh;margin:0}
.colophon-box{width:70%;border-top:1px solid #333;border-bottom:1px solid #333;padding:1.5em 0;color:#333;font-size:0.8em}
.colophon-title{font-size:1.4em;font-weight:bold;margin-bottom:1em}
.colophon-list{display:grid;grid-template-columns:auto 1fr;column-gap:1.5em;row-gap:0.5em;margin:0}
.colophon-list dt{font-weight:bold}
.colophon-list dd{margin:0}
.colophon-notes{margin-top:1em;font-size:0.9em;line-height:1.6;white-space:normal}
.tcy{text-combine-upright:all;-webkit-text-combine:horizontal}
ruby{ruby-align:center}rt{font-size:0.5em}
.cover{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;writing-mode:horizontal-tb;-webkit-writing-mode:horizontal-tb}
.cover img{max-width:100%;max-height:100%;object-fit:contain}
.cover-title{font-size:1.4em;font-weight:bold;text-align:center;padding:1em;line-height:1.4;writing-mode:vertical-rl;-webkit-writing-mode:vertical-rl}
.backmatter-page{writing-mode:horizontal-tb;-webkit-writing-mode:horizontal-tb;display:flex;align-items:flex-end;justify-content:center;height:100vh;margin:0}
.backmatter{font-size:0.75em;color:#666;margin-bottom:2em}
.backmatter a{color:#666;text-decoration:none}`)

    // cover
    if (options.coverImage) {
        zip.file(`OEBPS/cover.${coverExt}`, options.coverImage.data)
        zip.file('OEBPS/cover.xhtml', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8"/><title>表紙</title><link rel="stylesheet" href="style.css"/></head>
<body class="cover"><img src="cover.${coverExt}" alt="表紙"/></body>
</html>`))
    } else {
        zip.file('OEBPS/cover.xhtml', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8"/><title>表紙</title><link rel="stylesheet" href="style.css"/></head>
<body class="cover"><div class="cover-title">${escapeXml(options.title)}</div></body>
</html>`))
    }

    // title page
    const authorLine = options.author ? `<div class="author">${escapeXml(options.author)}</div>` : ''
    zip.file('OEBPS/title.xhtml', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8"/><title>${escapeXml(options.title)}</title><link rel="stylesheet" href="style.css"/></head>
<body class="titlepage">
  <div class="titlebox">
    <div class="title">${escapeXml(options.title)}</div>
    ${authorLine}
  </div>
</body>
</html>`))

    // content.xhtml
    let tocIdx = 0
    const body = processed.map((p) => {
        if (p.type === 'h1' || p.type === 'h2' || p.type === 'h3') {
            return `<${p.type} id="toc-${tocIdx++}">${p.text}</${p.type}>`
        }
        const classes: string[] = []
        if (p.type === 'p' && p.noIndent) classes.push('no-indent')
        if (p.type === 'p' && p.isBlank) classes.push('blank')
        const classAttr = classes.length ? ` class="${classes.join(' ')}"` : ''
        return `<${p.type}${classAttr}>${p.text}</${p.type}>`
    }).join('\n')

    zip.file('OEBPS/content.xhtml', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8"/><title>${escapeXml(options.title)}</title><link rel="stylesheet" href="style.css"/></head>
<body>
${body}
</body>
</html>`))

    if (hasColophon) {
        const titleHtml = options.title ? `<div class="colophon-title">${escapeXml(options.title)}</div>` : ''
        const lines = [
            options.author ? `<dt>著　者</dt><dd>${escapeXml(options.author)}</dd>` : '',
            options.issuer ? `<dt>発行者</dt><dd>${escapeXml(options.issuer)}</dd>` : '',
            options.publicationDate ? `<dt>発行日</dt><dd>${escapeXml(options.publicationDate)}</dd>` : '',
            options.publisher ? `<dt>発　行</dt><dd>${escapeXml(options.publisher)}</dd>` : '',
        ].filter(Boolean).join('\n')
        const notes = options.colophonNotes ? `<p class="colophon-notes">${formatColophonNotes(options.colophonNotes)}</p>` : ''
        zip.file('OEBPS/colophon.xhtml', fixXml(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8"/><title>奥付</title><link rel="stylesheet" href="style.css"/></head>
<body class="colophon-page">
  <div class="colophon-box">
    ${titleHtml}
    <dl class="colophon-list">
${lines}
    </dl>
    ${notes}
  </div>
</body>
</html>`))
    }

    // backmatter
    zip.file('OEBPS/backmatter.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8"/><title></title><link rel="stylesheet" href="style.css"/></head>
<body class="backmatter-page"><div class="backmatter"><p><a href="https://5hon.com">Published on 5hon.com</a></p></div></body>
</html>`)

    return await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip', compression: 'DEFLATE' })
}

function escapeXml(text: string): string {
    return text
        // 不正なXML文字を除去（制御文字など）
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // XMLエンティティをエスケープ
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

// テキストのサニタイズ（不正な文字参照を除去）
function sanitizeText(text: string): string {
    // 不正な数値文字参照を除去（&#0; - &#31; など、ただし &#9;, &#10;, &#13; は許可）
    return text.replace(/&#([0-9]+);/g, (match, num) => {
        const code = parseInt(num, 10)
        if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || code > 159) {
            return match
        }
        return '' // 不正な文字参照を削除
    }).replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        const code = parseInt(hex, 16)
        if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || code > 159) {
            return match
        }
        return '' // 不正な文字参照を削除
    })
}

// 最終的なXMLのサニタイズ（エスケープ漏れの&を救済）
function fixXml(xml: string): string {
    // &の後に有効なエンティティ（&amp;など）が続いていない場合、&amp;に置換
    return xml.replace(/&(?![a-zA-Z0-9]+;|#[0-9]+;|#x[0-9a-fA-F]+;)/g, '&amp;')
}

function formatColophonNotes(text: string): string {
    return escapeXml(text).replace(/\r?\n/g, '<br/>')
}

function toSafeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim()
}

// ========== エンドポイント ==========

export const POST: APIRoute = async (context) => {
    try {
        const body = (await context.request.json()) as RequestBody

        if (!body.url) {
            return errorResponse('INVALID_URL', 'URLを入力してください')
        }

        const docId = extractDocId(body.url)
        if (!docId) {
            return errorResponse('INVALID_URL', '有効なGoogleドキュメントのURLを入力してください')
        }

        const fetchResult = await fetchGoogleDocHtml(docId)
        if (!fetchResult.success) {
            return errorResponse(fetchResult.errorCode || 'FETCH_FAILED', fetchResult.error || 'ドキュメントの取得に失敗しました')
        }

        const parsed = parseGoogleDocHtml(fetchResult.html!, fetchResult.title!)
        if (parsed.paragraphs.length === 0) {
            return errorResponse('PARSE_FAILED', 'ドキュメントの内容を解析できませんでした')
        }

        let coverImage: { data: ArrayBuffer; type: 'jpeg' | 'png' } | undefined
        if (body.coverBase64 && body.coverType) {
            try {
                const binary = atob(body.coverBase64)
                const bytes = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i)
                }
                coverImage = { data: bytes.buffer, type: body.coverType }
            } catch {
                // ignore
            }
        }

        const requestedTitle = body.title?.trim()
        const finalTitle = requestedTitle || parsed.title
        const filenameBase = toSafeFilename(finalTitle || 'output') || 'output'
        const downloadFilename = `${filenameBase}.epub`

        const epub = await buildEpub(parsed.paragraphs, {
            title: finalTitle,
            author: body.author,
            publicationDate: body.publicationDate,
            publisher: body.publisher,
            issuer: body.issuer,
            edition: body.edition,
            colophonNotes: body.colophonNotes,
            identifier: `${docId}-${Date.now()}`,
            tcyNumbers: body.options?.tcyNumbers ?? true,
            tcyLatin: body.options?.tcyLatin ?? false,
            tocPage: body.options?.tocPage ?? true,
            coverImage,
        })

        return new Response(epub, {
            headers: {
                'Content-Type': 'application/epub+zip',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
            },
        })
    } catch (error) {
        console.error('EPUB error:', error)
        return errorResponse('EPUB_BUILD_FAILED', 'EPUB生成中にエラーが発生しました')
    }
}

function errorResponse(code: string, message: string): Response {
    return new Response(JSON.stringify({ errorCode: code, message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
    })
}

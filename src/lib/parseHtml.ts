/**
 * HTML正規化・パースモジュール
 * Google DocsのHTMLから本文を抽出し、整形する
 */

export interface ParsedContent {
    title: string
    paragraphs: ContentNode[]
}

export interface ContentNode {
    type: 'p' | 'h1' | 'h2' | 'h3'
    text: string
    isBlank?: boolean
}

/**
 * Google Docs HTMLを正規化して本文を抽出
 */
export function parseGoogleDocHtml(html: string, title: string): ParsedContent {
    // bodyの中身を抽出
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyContent = bodyMatch ? bodyMatch[1] : html

    // 不要なタグを除去（style, script, head等）
    let cleaned = bodyContent
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')

    const paragraphs: ContentNode[] = []

    // 見出しと段落を順番に抽出
    const tagRegex = /<(h1|h2|h3|p)[^>]*>([\s\S]*?)<\/\1>/gi
    let match
    while ((match = tagRegex.exec(cleaned)) !== null) {
        const type = match[1].toLowerCase() as ContentNode['type']
        const raw = match[2]
        const text = stripHtmlTags(raw)
        if (text.trim()) {
            paragraphs.push({ type, text: text.trim() })
        } else if (type === 'p' && isBlankParagraph(raw)) {
            paragraphs.push({ type: 'p', text: '', isBlank: true })
        }
    }

    // 要素がない場合は全体をプレーンテキストとして扱う
    if (paragraphs.length === 0) {
        const plainText = stripHtmlTags(cleaned)
        if (plainText.trim()) {
            // 改行で分割
            plainText.split(/\n+/).forEach((line) => {
                if (line.trim()) {
                    paragraphs.push({ type: 'p', text: line.trim() })
                }
            })
        }
    }

    return {
        title,
        paragraphs,
    }
}

/**
 * HTMLタグを除去してプレーンテキストを取得
 */
function stripHtmlTags(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
}

function isBlankParagraph(html: string): boolean {
    if (html.trim() === '') return true
    if (/<br\s*\/?>|&nbsp;|\u00a0/i.test(html)) return true
    if (/class=(\"|')[^\"']*\bc3\b[^\"']*(\"|')/i.test(html)) return true
    if (/<span[^>]*>\s*<\/span>/i.test(html)) return true
    return false
}

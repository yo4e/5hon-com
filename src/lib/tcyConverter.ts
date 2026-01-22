/**
 * 縦中横変換モジュール
 * 短い数字や英字を縦中横（tcy）に変換
 */

// import { isInsideRuby } from './rubyConverter'

/**
 * 縦中横変換オプション
 */
export interface TcyOptions {
    numbers: boolean  // 数字を縦中横
    latin: boolean    // 英字を縦中横
}

/**
 * 縦中横変換を適用
 * 2-4文字の数字/英字を <span class="tcy">...</span> で囲む
 */
export function convertTcy(text: string, options: TcyOptions): string {
    let result = text

    // 数字の縦中横（2-4桁）
    if (options.numbers) {
        result = applyTcyPattern(result, /[0-9]{1,4}/g)
    }

    // 英字の縦中横（2-4文字）
    if (options.latin) {
        result = applyTcyPattern(result, /[A-Za-z!?.,:;@#$%&+*=/\\-]{1,4}/g)
    }

    return result
}

/**
 * パターンに一致する箇所を縦中横に変換
 * ただし、rubyタグ内やrtタグ内は除外
 */
function applyTcyPattern(text: string, pattern: RegExp): string {
    // ruby/rtタグ内を検出するための正規表現
    const tagPattern = /<[^>]+>/g

    // テキストをタグと非タグ部分に分割
    const parts: { text: string; isTag: boolean; inRuby: boolean }[] = []
    let lastIndex = 0
    let inRuby = false
    let inRt = false
    let match

    while ((match = tagPattern.exec(text)) !== null) {
        // タグの前のテキスト
        if (match.index > lastIndex) {
            parts.push({
                text: text.substring(lastIndex, match.index),
                isTag: false,
                inRuby: inRuby || inRt,
            })
        }

        // タグ自体
        const tagNameMatch = match[0].match(/^<\/?([a-zA-Z0-9]+)/)
        const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : ''
        if (tagName === 'ruby') inRuby = !match[0].startsWith('</')
        else if (tagName === 'rt') inRt = !match[0].startsWith('</')

        parts.push({
            text: match[0],
            isTag: true,
            inRuby: false,
        })

        lastIndex = match.index + match[0].length
    }

    // 残りのテキスト
    if (lastIndex < text.length) {
        parts.push({
            text: text.substring(lastIndex),
            isTag: false,
            inRuby: inRuby || inRt,
        })
    }

    // 各パートを処理
    return parts
        .map((part) => {
            if (part.isTag || part.inRuby) {
                return part.text
            }
            // ruby外のテキストにのみ縦中横を適用
            return part.text.replace(pattern, (m) => `<span class="tcy">${m}</span>`)
        })
        .join('')
}

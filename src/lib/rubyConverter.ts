/**
 * ルビ変換モジュール
 * ｜漢字《かんじ》 形式をHTMLのrubyタグに変換
 */

/**
 * ルビ記法をrubyタグに変換
 * pattern: ｜本文《ルビ》
 * 
 * 例: ｜漢字《かんじ》 → <ruby>漢字<rt>かんじ</rt></ruby>
 */
export function convertRuby(text: string): string {
    // ｜（全角縦棒）で始まるルビ記法
    // ｜本文《ルビ》
    const rubyPattern = /｜([^《]+)《([^》]+)》/g

    return text.replace(rubyPattern, (_match, base, ruby) => {
        // 安全のためエスケープ
        const safeBase = escapeHtml(base)
        const safeRuby = escapeHtml(ruby)
        return `<ruby>${safeBase}<rt>${safeRuby}</rt></ruby>`
    })
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/**
 * ルビタグ内のテキストかどうかを判定（縦中横変換で使用）
 */
export function isInsideRuby(text: string, position: number): boolean {
    // position より前の <ruby> と </ruby> の数を比較
    const before = text.substring(0, position)
    const rubyOpens = (before.match(/<ruby>/g) || []).length
    const rubyCloses = (before.match(/<\/ruby>/g) || []).length
    return rubyOpens > rubyCloses
}

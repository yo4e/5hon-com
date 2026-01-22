/**
 * Google Docs HTML取得モジュール
 */

export interface FetchResult {
    success: boolean
    html?: string
    title?: string
    error?: string
    errorCode?: string
}

/**
 * Google Docs URLからドキュメントIDを抽出
 */
export function extractDocId(url: string): string | null {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
}

/**
 * Google DocsからHTML形式でエクスポート取得
 */
export async function fetchGoogleDocHtml(docId: string): Promise<FetchResult> {
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

        // ログイン誘導ページの検出
        if (html.includes('accounts.google.com') || html.includes('ServiceLogin')) {
            return {
                success: false,
                error: 'このドキュメントは非公開の可能性があります。「リンクを知っている全員が閲覧可」に設定してください。',
                errorCode: 'NOT_PUBLIC',
            }
        }

        // タイトル抽出
        const titleMatch = html.match(/<title>([^<]+)<\/title>/)
        const title = titleMatch ? titleMatch[1].replace(/ - Google ドキュメント$/, '').trim() : 'Untitled'

        return {
            success: true,
            html,
            title,
        }
    } catch (error) {
        return {
            success: false,
            error: `ネットワークエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown'}`,
            errorCode: 'FETCH_FAILED',
        }
    }
}

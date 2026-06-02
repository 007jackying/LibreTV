// netlify/functions/image-proxy.mjs - Netlify Function for Douban image proxy
// Mirrors LunaTV's /api/image-proxy/route.ts mechanism

export async function handler(event) {
    const imageUrl = event.queryStringParameters?.url;

    if (!imageUrl) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '缺少图片URL参数' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: '无效的URL' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }
    } catch {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '无效的URL' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const response = await fetch(imageUrl, {
            headers: {
                'Referer': 'https://movie.douban.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
            }
        });

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: response.statusText }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=15720000',
            },
            body: Buffer.from(buffer).toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '获取图片失败' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
}

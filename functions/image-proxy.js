// functions/image-proxy.js - Cloudflare Pages Function for Douban image proxy
// Mirrors LunaTV's /api/image-proxy/route.ts mechanism

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
        return new Response(JSON.stringify({ error: '缺少图片URL参数' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return new Response(JSON.stringify({ error: '无效的URL' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch {
        return new Response(JSON.stringify({ error: '无效的URL' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
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
            return new Response(JSON.stringify({ error: response.statusText }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return new Response(response.body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=15720000',
                'Access-Control-Allow-Origin': '*',
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: '获取图片失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

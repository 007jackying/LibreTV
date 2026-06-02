// /api/image-proxy.mjs - Vercel Serverless Function for Douban image proxy
// Mirrors LunaTV's /api/image-proxy/route.ts mechanism

import fetch from 'node-fetch';
import { URL } from 'url';

export default async function handler(req, res) {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).json({ error: '缺少图片URL参数' });
    }

    try {
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.status(400).json({ error: '无效的URL' });
        }
    } catch {
        return res.status(400).json({ error: '无效的URL' });
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
            return res.status(response.status).json({ error: response.statusText });
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=15720000, s-maxage=15720000');

        response.body.pipe(res);
    } catch (error) {
        res.status(500).json({ error: '获取图片失败' });
    }
}

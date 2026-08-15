export default async function handler(req, res) {
    // 1. Injetar Headers CORS Universal ANTES de qualquer verificação
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, PATCH, DELETE, POST, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    // 2. Tratamento de requisições OPTIONS (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Nenhuma URL fornecida.', code: 'MISSING_URL' });
    }

    // 3. Validação de Segurança e Prevenção de SSRF
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        
        // Bloquear endereços de rede local/privada
        if (
            hostname === 'localhost' || 
            hostname === '127.0.0.1' || 
            hostname === '::1' ||
            hostname.startsWith('10.') || 
            hostname.startsWith('192.168.') || 
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
            hostname.endsWith('.internal') ||
            hostname.endsWith('.local')
        ) {
            return res.status(403).json({ error: 'Requisições para a rede local são estritamente bloqueadas.', code: 'SSRF_BLOCKED' });
        }
        
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return res.status(400).json({ error: 'Protocolo não suportado. Use http ou https.', code: 'INVALID_PROTOCOL' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'URL malformada.', code: 'MALFORMED_URL' });
    }

    // 4. Repasse (Fetch)
    try {
        // Omite o Referer para não expor a Vercel e envia um UA tolerado
        const response = await fetch(url, {
            method: req.method,
            headers: {
                'User-Agent': 'VLC/3.0.9 LibVLC/3.0.9',
                'Accept': '*/*',
                'Referer': '' 
            },
            redirect: 'follow'
        });

        // Copia o Content-Type se ele existir, ou usa text/plain
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        } else {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        }

        // Se o Upstream (Provedor IPTV) retornar erro, NÃO mascara o erro
        if (!response.ok) {
            // Em vez de retornar erro genérico sem CORS, o cabeçalho já está lá
            // Vamos retornar o status exato e um corpo JSON de diagnóstico
            res.setHeader('Content-Type', 'application/json');
            return res.status(response.status).json({
                error: `O servidor IPTV retornou HTTP ${response.status} ${response.statusText}`,
                code: 'UPSTREAM_ERROR',
                upstream_status: response.status
            });
        }

        // Se deu tudo certo, pega o array buffer (ideal para M3U e binários como TS)
        const buffer = await response.arrayBuffer();
        return res.status(200).send(Buffer.from(buffer));
        
    } catch (error) {
        // Erro de falha de conexão (DNS, timeout, Vercel não alcançou o host)
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({
            error: `Erro interno do Proxy Vercel: ${error.message}`,
            code: 'PROXY_INTERNAL_ERROR'
        });
    }
}

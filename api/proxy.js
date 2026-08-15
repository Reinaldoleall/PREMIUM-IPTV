export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('No URL provided');
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch from upstream: ${response.statusText}`);
        }

        const text = await response.text();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        
        res.status(200).send(text);
    } catch (error) {
        res.status(500).send(`Proxy error: ${error.message}`);
    }
}

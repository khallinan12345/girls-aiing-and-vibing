export default async function handler(req, res) {
  try {
    const { prompt, size = '1024x1024' } = req.body || {};
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    const b64 = data?.data?.[0]?.b64_json || null;
    return res.status(200).json({ b64 });
  } catch (e:any) {
    return res.status(500).json({ error: e.message });
  }
}

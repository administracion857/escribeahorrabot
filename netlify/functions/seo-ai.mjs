export default async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found');
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const { action, topic, goal, context, analysis, confirmedArticles } = req.body;

    if (action === 'research') {
      // Analizar keyword
      const prompt = `Analiza este keyword para SEO: "${topic}". Objetivo: ${goal}. Contexto: ${context}. Devuelve JSON: {"primary_keyword":"...","secondary_keywords":[],"overall_score":7,"verdict":"SI"}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const analysis = JSON.parse(jsonMatch[0]);
      analysis.overall_score = parseInt(analysis.overall_score) || 5;

      return res.status(200).json({ data: analysis });
    }

    if (action === 'generate') {
      // Generar artículo
      const prompt = `Crea un artículo HTML sobre: "${topic}". Devuelve JSON: {"title":"...","slug":"...","meta_description":"...","content":"<article>...</article>"}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const article = JSON.parse(jsonMatch[0]);

      const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} | AhorraBot</title>
    <meta name="description" content="${article.meta_description}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui; line-height: 1.6; color: #333; background: #f9f9f9; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
        .container { max-width: 800px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <header><h1>${article.title}</h1></header>
    <div class="container">
        ${article.content}
    </div>
</body>
</html>`;

      return res.status(200).json({ data: {
        title: article.title,
        slug: article.slug || 'articulo',
        meta_description: article.meta_description || '',
        html: htmlContent,
        blogIndex: '<html></html>',
        sitemap: '<?xml version="1.0"?><urlset></urlset>',
      }});
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Function error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

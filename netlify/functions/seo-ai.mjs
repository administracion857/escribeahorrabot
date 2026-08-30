import fetch from 'node-fetch';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Normalizar slug: convertir a lowercase, reemplazar espacios y caracteres especiales
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Eliminar acentos
    .replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/--+/g, '-') // Múltiples guiones a uno
    .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio/fin
}

// Función para llamar a OpenAI
async function callOpenAI(prompt, model = 'gpt-4o') {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    throw error;
  }
}

// Analizar keyword con OpenAI
async function analyzeKeyword(keyword, goal, context) {
  const prompt = `
Analiza este keyword para SEO en español (España):
Keyword: "${keyword}"
Objetivo: ${goal}
Contexto: ${context}

Proporciona un análisis en formato JSON con:
{
  "primary_keyword": "keyword principal",
  "secondary_keywords": ["keyword2", "keyword3"],
  "search_volume": "estimación de búsquedas/mes",
  "difficulty": "fácil/medio/difícil",
  "commercial_intent": "alta/media/baja",
  "user_intent": "informativo/transaccional/navegacional",
  "viability": "descripción de viabilidad",
  "overall_score": 8,
  "verdict": "SI/NO - si vale la pena crear contenido"
}

Basándote en:
- Demanda de búsqueda
- Relevancia para España
- Potencial comercial para AhorraBot
- Competencia estimada

Sé directo y conciso.`;

  try {
    const response = await callOpenAI(prompt);

    // Extraer JSON de la respuesta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Asegurar que overall_score es un número
    analysis.overall_score = parseInt(analysis.overall_score) || 5;

    return analysis;
  } catch (error) {
    console.error('Analysis error:', error.message);
    return null;
  }
}

// Generar artículo con OpenAI
async function generateArticle(topic, analysis, confirmedArticles) {
  const recentArticles = confirmedArticles.slice(-5).map(a => a.title).join(', ');

  const prompt = `
Crea un artículo de blog completo en HTML sobre: "${topic}"

Análisis del keyword:
- Primary: ${analysis.primary_keyword}
- Secondarios: ${analysis.secondary_keywords.join(', ')}
- Intent: ${analysis.user_intent}

Artículos recientes (evitar duplicar): ${recentArticles || 'ninguno'}

Requisitos:
1. Título atractivo y optimizado para SEO
2. Meta descripción (160 caracteres)
3. Contenido 1200-1500 palabras
4. H2 y H3 bien estructurados
5. Párrafos cortos (máx 3 líneas)
6. Incluir datos/números relevantes
7. CTA al final
8. Incluir keywords secundarios de forma natural
9. Optimizado para lectura en móvil

Responde SOLO con JSON:
{
  "title": "Título del artículo",
  "slug": "url-del-articulo",
  "meta_description": "Descripción para Google",
  "content": "<article>... HTML aquí ...</article>",
  "image_prompt": "Descripción para generar imagen (para Unsplash)"
}

Importante: El HTML debe estar completo y listo para publicar.`;

  try {
    const response = await callOpenAI(prompt);

    // Extraer JSON de la respuesta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const article = JSON.parse(jsonMatch[0]);

    // Generar slug si no viene
    if (!article.slug) {
      article.slug = generateSlug(article.title);
    }

    // Crear HTML completo con estructura
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} | AhorraBot</title>
    <meta name="description" content="${article.meta_description}">
    <meta property="og:title" content="${article.title}">
    <meta property="og:description" content="${article.meta_description}">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${article.title}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #f9f9f9; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
        header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .container { max-width: 800px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        article h2 { color: #667eea; margin-top: 30px; margin-bottom: 15px; font-size: 1.8em; }
        article h3 { color: #764ba2; margin-top: 20px; margin-bottom: 10px; font-size: 1.3em; }
        article p { margin-bottom: 15px; }
        article a { color: #667eea; text-decoration: none; }
        article a:hover { text-decoration: underline; }
        .meta { color: #999; font-size: 0.9em; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .cta { background: #667eea; color: white; padding: 20px; border-radius: 8px; margin-top: 30px; text-align: center; }
        footer { text-align: center; color: #999; margin-top: 30px; font-size: 0.9em; }
    </style>
</head>
<body>
    <header>
        <h1>${article.title}</h1>
        <p>💡 Ahorra dinero con AhorraBot</p>
    </header>
    <div class="container">
        <div class="meta">
            <p>📅 ${new Date().toLocaleDateString('es-ES')} | ⏱️ Lectura: 5 min</p>
        </div>
        ${article.content}
        <div class="cta">
            <h3>¿Quieres ahorrar más?</h3>
            <p>Descubre más consejos y comparativas en AhorraBot.</p>
        </div>
    </div>
    <footer>
        <p>&copy; 2026 AhorraBot. Todos los derechos reservados.</p>
    </footer>
</body>
</html>`;

    return {
      title: article.title,
      slug: article.slug,
      meta_description: article.meta_description,
      html: htmlContent,
      blogIndex: generateBlogIndex(article, confirmedArticles),
      sitemap: generateSitemap(article, confirmedArticles),
    };
  } catch (error) {
    console.error('Generation error:', error.message);
    return null;
  }
}

// Generar index.html con lista de artículos
function generateBlogIndex(article, confirmedArticles) {
  const allArticles = [...confirmedArticles, { title: article.title, slug: article.slug, date: new Date().toISOString() }];

  const articleList = allArticles
    .map(a => `<li><a href="/blog/${a.slug}.html">${a.title}</a> <span>${new Date(a.date).toLocaleDateString('es-ES')}</span></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog - AhorraBot</title>
    <meta name="description" content="Blog de consejos para ahorrar dinero en servicios: electricidad, gas, seguros y más.">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #f9f9f9; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
        header h1 { font-size: 2.5em; }
        .container { max-width: 800px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        ul { list-style: none; }
        li { padding: 15px 0; border-bottom: 1px solid #eee; }
        li a { color: #667eea; text-decoration: none; font-size: 1.1em; }
        li a:hover { text-decoration: underline; }
        li span { color: #999; font-size: 0.9em; margin-left: 10px; }
        footer { text-align: center; color: #999; margin-top: 30px; font-size: 0.9em; }
    </style>
</head>
<body>
    <header>
        <h1>📚 Blog AhorraBot</h1>
        <p>Consejos para ahorrar en servicios</p>
    </header>
    <div class="container">
        <h2>Últimos artículos</h2>
        <ul>
            ${articleList}
        </ul>
    </div>
    <footer>
        <p>&copy; 2026 AhorraBot. Todos los derechos reservados.</p>
    </footer>
</body>
</html>`;
}

// Generar sitemap.xml
function generateSitemap(article, confirmedArticles) {
  const allArticles = [...confirmedArticles, { slug: article.slug, date: new Date().toISOString() }];

  const urls = allArticles
    .map(a => `  <url>
    <loc>https://hilarious-phoenix-61f665.netlify.app/blog/${a.slug}.html</loc>
    <lastmod>${a.date.split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://hilarious-phoenix-61f665.netlify.app/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;
}

// Netlify Function Handler
export default async (req, res) => {
  // CORS headers
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
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const { action, topic, goal, context, analysis, confirmedArticles } = req.body;

    if (action === 'research') {
      const result = await analyzeKeyword(topic, goal, context);
      if (!result) {
        return res.status(400).json({ error: 'Failed to analyze keyword' });
      }
      return res.status(200).json({ data: result });
    }

    if (action === 'generate') {
      const result = await generateArticle(topic, analysis, confirmedArticles || []);
      if (!result) {
        return res.status(400).json({ error: 'Failed to generate article' });
      }
      return res.status(200).json({ data: result });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Function error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

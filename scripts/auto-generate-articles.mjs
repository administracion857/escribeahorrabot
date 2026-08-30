import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_KEY || 'demo';
const NETLIFY_BUILD_HOOK = process.env.NETLIFY_BUILD_HOOK;

const KEYWORDS_FILE = 'keywords-seed.json';
const CONFIRMED_FILE = 'confirmed-articles.json';
const NETLIFY_FUNCTION_URL = 'hilarious-phoenix-61f665.netlify.app';

async function analyzeKeyword(keyword, goal, context) {
  try {
    const payload = {
      action: 'research',
      topic: keyword,
      goal: goal,
      context: context,
    };

    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`   ⚠️  Error analizando: ${error.message}`);
    return null;
  }
}

async function generateArticle(topic, analysis, confirmedArticles) {
  try {
    const payload = {
      action: 'generate',
      topic: topic,
      analysis: analysis,
      confirmedArticles: confirmedArticles,
    };

    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`   ⚠️  Error generando: ${error.message}`);
    return null;
  }
}

function loadConfirmedArticles() {
  try {
    if (fs.existsSync(CONFIRMED_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIRMED_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error cargando artículos confirmados:', error.message);
  }
  return [];
}

function saveConfirmedArticles(articles) {
  fs.writeFileSync(CONFIRMED_FILE, JSON.stringify(articles, null, 2));
}

function saveArticleFiles(article) {
  const blogDir = 'blog';
  if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

  const articlePath = path.join(blogDir, `${article.slug}.html`);
  fs.writeFileSync(articlePath, article.html);

  const indexPath = 'index.html';
  fs.writeFileSync(indexPath, article.blogIndex);

  const sitemapPath = 'sitemap.xml';
  fs.writeFileSync(sitemapPath, article.sitemap);

  console.log(`✅ Artículo guardado: ${articlePath}`);
}

async function commitAndPush(articleTitle) {
  try {
    execSync('git config user.email "github-actions@ahorrabot.es"');
    execSync('git config user.name "GitHub Actions"');
    execSync('git add .');
    execSync(`git commit -m "🤖 Auto: Nuevo artículo - ${articleTitle}"`);
    execSync('git push origin main');
    console.log('✅ Cambios pushed a GitHub');
  } catch (error) {
    console.error('Error en git:', error.message);
  }
}

async function triggerNetlifyBuild() {
  if (!NETLIFY_BUILD_HOOK) {
    console.log('⚠️  NETLIFY_BUILD_HOOK no configurado, saltando trigger');
    return;
  }

  try {
    await fetch(NETLIFY_BUILD_HOOK, { method: 'POST' });
    console.log('✅ Build de Netlify triggerizado');
  } catch (error) {
    console.error('Error triggerizando Netlify:', error.message);
  }
}

function getRandomKeyword(keywords, excludeSlugs = []) {
  const available = keywords.filter(
    k => !excludeSlugs.some(slug => k.toLowerCase().replace(/[^a-z0-9]/g, '-') === slug)
  );

  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

async function main() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
  }

  console.log('🤖 Generador Automático - Keywords Estratégicos\n');

  const seedConfig = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf-8'));
  const { strategicKeywords, config } = seedConfig;

  const confirmedArticles = loadConfirmedArticles();
  const confirmedSlugs = confirmedArticles.map(a => a.slug);

  console.log(`📊 Artículos confirmados hasta ahora: ${confirmedArticles.length}`);
  console.log(`📝 Keywords disponibles: ${strategicKeywords.length}\n`);

  let articlesGenerated = 0;
  let analysisAttempts = 0;

  // Intentar generar 1 artículo máximo
  for (let attempt = 0; attempt < Math.min(config.maxArticlesPerRun * 3, strategicKeywords.length); attempt++) {
    if (articlesGenerated >= config.maxArticlesPerRun) break;

    // Seleccionar un keyword al azar (que no haya sido confirmado)
    const keyword = getRandomKeyword(strategicKeywords, confirmedSlugs);
    if (!keyword) {
      console.log('⛔ No hay keywords disponibles sin confirmar');
      break;
    }

    try {
      analysisAttempts++;
      console.log(`🔍 [${analysisAttempts}/${strategicKeywords.length}] Analizando: "${keyword}"`);

      const analysis = await analyzeKeyword(keyword, config.intention, config.vision);

      if (!analysis) {
        console.log(`   ⚠️  No se pudo analizar, saltando\n`);
        continue;
      }

      console.log(`   Score: ${analysis.overall_score}/10 | Veredicto: ${analysis.verdict}`);

      if (analysis.overall_score >= config.minScore) {
        console.log(`   ✅ Score >= ${config.minScore}, generando artículo...\n`);

        const article = await generateArticle(keyword, analysis, confirmedArticles);

        if (!article) {
          console.log(`   ⚠️  No se pudo generar, saltando\n`);
          continue;
        }

        // Guardar archivos
        saveArticleFiles(article);

        // Agregar a confirmados
        const newArticle = {
          title: analysis.primary_keyword,
          slug: article.slug,
          date: new Date().toISOString(),
        };
        confirmedArticles.push(newArticle);
        saveConfirmedArticles(confirmedArticles);

        articlesGenerated++;
        console.log(`✨ Artículo generado exitosamente!\n`);

      } else {
        console.log(`   ❌ Score ${analysis.overall_score} < ${config.minScore}, saltando\n`);
      }

    } catch (error) {
      console.error(`   ⚠️  Error: ${error.message}\n`);
    }

    // Pequeño delay entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   - Keywords analizados: ${analysisAttempts}`);
  console.log(`   - Artículos generados: ${articlesGenerated}`);
  console.log(`   - Total confirmados: ${confirmedArticles.length}`);

  if (articlesGenerated > 0) {
    console.log(`\n📤 Preparando deploy...`);
    await commitAndPush(`${articlesGenerated} artículos generados`);
    await triggerNetlifyBuild();
    console.log(`\n🎉 Completado! ${articlesGenerated} artículos generados y deployados`);
  } else {
    console.log(`\n⚠️  No se generaron artículos esta ejecución (todos tenían score < ${config.minScore})`);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});

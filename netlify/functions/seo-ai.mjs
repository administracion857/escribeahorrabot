export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    console.log('DEBUG: OPENAI_API_KEY exists:', !!OPENAI_API_KEY);
    console.log('DEBUG: OPENAI_API_KEY length:', OPENAI_API_KEY?.length);

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not found in environment' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10,
      }),
    });

    const data = await response.json();
    return res.status(200).json({ data });
  } catch (error) {
    console.error('ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({ 
    data: {
      primary_keyword: "test",
      overall_score: 8,
      verdict: "SI"
    }
  });
};

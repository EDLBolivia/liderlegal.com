import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contents, config } = req.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error('API key not found in environment variables.');
      return res.status(500).json({ error: 'La clave de API no está configurada en el servidor.' });
    }
    if (!contents) {
        return res.status(400).json({ error: 'Falta el contenido ("contents") en la solicitud.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: config || {},
    });

    if (config?.responseMimeType === 'application/json') {
        const resultJson = JSON.parse(response.text);
        return res.status(200).json(resultJson);
    } else {
        return res.status(200).json({ text: response.text });
    }

  } catch (error) {
    console.error('Error en la ruta API:', error);
    return res.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
  }
}

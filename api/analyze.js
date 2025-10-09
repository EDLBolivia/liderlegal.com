import { GoogleGenAI } from '@google/genai';

/**
 * Extracts and parses a JSON object from a string that might contain other text or markdown.
 * @param {string} text The text to parse.
 * @returns {object} The parsed JSON object.
 * @throws {Error} If no valid JSON object is found or if parsing fails.
 */
function extractAndParseJson(text) {
  // Find the first '{' and the last '}' to best capture the JSON object.
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');
  
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    console.error("Invalid response format from model:", text);
    throw new Error("No se encontró un objeto JSON válido en la respuesta del modelo.");
  }

  const jsonString = text.substring(startIndex, endIndex + 1);
  
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Error parsing extracted JSON string:", jsonString);
    throw new Error("El modelo de IA devolvió una respuesta con formato JSON inválido.");
  }
}

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
        const resultJson = extractAndParseJson(response.text);
        return res.status(200).json(resultJson);
    } else {
        return res.status(200).json({ text: response.text });
    }

  } catch (error) {
    console.error('Error en la ruta API:', error);
    const errorMessage = error.message || 'Ocurrió un error interno en el servidor.';
    return res.status(500).json({ error: errorMessage });
  }
}

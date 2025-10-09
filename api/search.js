import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { query } = await request.json();
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY is not configured in Vercel");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const systemInstruction = `
        Eres un asistente de investigación legal experto EXCLUSIVAMENTE en el marco normativo de Bolivia.
        Tu única fuente de verdad son los datos de la Gaceta Oficial de Bolivia, Lexivox, el SILEP, y la jurisprudencia del Tribunal Constitucional Plurinacional (TCP).
        Responde a la consulta del usuario de manera clara y directa, citando las fuentes específicas (artículo, número de ley, número de sentencia).
        SI NO ENCUENTRAS la información precisa en estas fuentes, tu ÚNICA Y OBLIGATORIA respuesta debe ser: [ADVERTENCIA: DATO NO VERIFICADO. NO SE ENCONTRÓ LA NORMA BOLIVIANA EN LA BASE DE DATOS VIGENTE.]
        No intentes adivinar ni usar conocimiento general.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
        config: {
            systemInstruction: systemInstruction,
        }
    });
    
    const resultText = response.text;

    return new Response(JSON.stringify({ result: resultText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search function:', error.message);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

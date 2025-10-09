import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { text } = await request.json();
    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY is not configured in Vercel");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `
        Eres "Líder Legal", un asistente experto en derecho boliviano. Analiza el siguiente texto legal.
        
        TAREAS A REALIZAR:
        1.  **ANÁLISIS DE ESTILO Y TERMINOLOGÍA:** Corrige el lenguaje coloquial, ambiguo o incorrecto, reemplazándolo con terminología jurídica precisa y formal de Bolivia.
        2.  **VERIFICACIÓN DE COHERENCIA CONTEXTUAL:** Identifica cada cita legal (artículos, sentencias, etc.). Usando tu conocimiento de las fuentes oficiales bolivianas (Gaceta, Lexivox, SILEP, TCP), evalúa si la cita es contextualmente relevante. Si un artículo de estafa se usa en un argumento de violación, o una sentencia de inmuebles en un caso familiar, márcalo como una "Alerta de Coherencia".
        3.  **GENERACIÓN DE RESULTADOS:** Devuelve un único objeto JSON. NO incluyas explicaciones fuera del JSON.

        REGLA DE FORMATO DEL TEXTO CORREGIDO: Es absolutamente CRÍTICO que el campo "textoCorregido" preserve la estructura original de párrafos y saltos de línea del texto original. No debe ser un solo bloque de texto.

        REGLA FINAL: Si detectas una Alerta de Coherencia, es CRÍTICO que la incluyas en las sugerencias y apliques la corrección sugerida en el "textoCorregido".

        TEXTO A ANALIZAR:
        ---
        ${text}
        ---
      `;
    
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        indiceTecnicidad: { type: Type.NUMBER, description: "Un puntaje de 0 a 100 evaluando la calidad formal y técnica del texto." },
        sugerencias: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING, description: "El fragmento de texto original que necesita corrección." },
              sugerencia: { type: Type.STRING, description: "La versión corregida y mejorada del fragmento." },
              razon: { type: Type.STRING, description: "La explicación clara de por qué se hizo la corrección." },
              tipo: { type: Type.STRING, description: "Tipo de sugerencia, ej: 'Estilo', 'Terminología', 'Coherencia'." },
              severidad: { type: Type.STRING, description: "Severidad, ej: 'Baja', 'Media', 'Crítica'." },
            }
          }
        },
        textoCorregido: { type: Type.STRING, description: "El texto completo con TODAS las sugerencias (incluyendo las críticas) aplicadas, respetando el formato original de párrafos." }
      }
    };
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    });

    return new Response(response.text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze function:', error.message);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

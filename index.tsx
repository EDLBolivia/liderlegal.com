import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

declare const mammoth: any;

const WORD_LIMIT = 3000;

interface Suggestion {
  original: string;
  sugerencia: string;
  razon: string;
  tipo: string;
  severidad: string;
}

interface AnalysisResult {
  indiceTecnicidad: number;
  sugerencias: Suggestion[];
  textoCorregido: string;
}

const App = () => {
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [searchResult, setSearchResult] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [visitorCount, setVisitorCount] = useState(2008);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedSearch, setCopiedSearch] = useState(false);
  
  const analysisCancelled = useRef(false);
  const searchCancelled = useRef(false);

  useEffect(() => {
      const count = localStorage.getItem('visitorCount');
      if (count) {
          const newCount = parseInt(count, 10) + 1;
          setVisitorCount(newCount);
          localStorage.setItem('visitorCount', newCount.toString());
      } else {
          localStorage.setItem('visitorCount', '2008');
          setVisitorCount(2008);
      }
  }, []);

  useEffect(() => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
  }, [text]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };
  
  const handleDocxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNotification(null);
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result;
          const result = await mammoth.extractRawText({ arrayBuffer });
          const words = result.value.trim().split(/\s+/).filter(Boolean);
          if (words.length > WORD_LIMIT) {
              setText(words.slice(0, WORD_LIMIT).join(' '));
              showNotification(`Documento truncado a ${WORD_LIMIT} palabras.`, 'success');
          } else {
              setText(result.value);
              showNotification('Documento Word cargado con éxito.', 'success');
          }
        } catch (error) {
          console.error("Error processing .docx file:", error);
          showNotification('No se pudo leer el archivo .docx. Intente con otro.', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
  };
  
  const handleAnalyze = async () => {
    if (!text.trim()) {
      showNotification('Por favor, ingrese texto para analizar.', 'error');
      return;
    }
    
    analysisCancelled.current = false;
    setIsLoadingAnalysis(true);
    setAnalysisResult(null);

    const truncatedText = text.trim().split(/\s+/).filter(Boolean).slice(0, WORD_LIMIT).join(' ');

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
        ${truncatedText}
        ---
      `;
      
    const requestBody = {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              indiceTecnicidad: { type: "INTEGER", description: "Un puntaje de 0 a 100 evaluando la calidad formal y técnica del texto." },
              sugerencias: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    original: { type: "STRING", description: "El fragmento de texto original que necesita corrección." },
                    sugerencia: { type: "STRING", description: "La versión corregida y mejorada del fragmento." },
                    razon: { type: "STRING", description: "La explicación clara de por qué se hizo la corrección." },
                    tipo: { type: "STRING", description: "Tipo de sugerencia, ej: 'Estilo', 'Terminología', 'Coherencia'." },
                    severidad: { type: "STRING", description: "Severidad, ej: 'Baja', 'Media', 'Crítica'." },
                  }
                }
              },
              textoCorregido: { type: "STRING", description: "El texto completo con TODAS las sugerencias (incluyendo las críticas) aplicadas, respetando el formato original de párrafos." }
            }
          }
        }
    };

    try {
      const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
      });
      
      if (analysisCancelled.current) return;
      
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error en la respuesta del servidor.');
      }

      const resultJson = await response.json();
      setAnalysisResult(resultJson);

    } catch (error) {
      if (analysisCancelled.current) return;
      console.error("Error durante el análisis:", error);
      showNotification(`Hubo un error durante el análisis: ${error.message}`, 'error');
    } finally {
      if (!analysisCancelled.current) {
        setIsLoadingAnalysis(false);
      }
    }
  };

  const handleSearch = async () => {
      if (!searchQuery.trim()) {
        showNotification('Por favor, ingrese una consulta para buscar.', 'error');
        return;
      }
      searchCancelled.current = false;
      setIsLoadingSearch(true);
      setSearchResult('');
      
      const requestBody = {
        contents: searchQuery,
        config: {
            systemInstruction: `
                Eres un asistente de investigación legal experto EXCLUSIVAMENTE en el marco normativo de Bolivia.
                Tu única fuente de verdad son los datos de la Gaceta Oficial de Bolivia, Lexivox, el SILEP, y la jurisprudencia del Tribunal Constitucional Plurinacional (TCP).
                Responde a la consulta del usuario de manera clara y directa, citando las fuentes específicas (artículo, número de ley, número de sentencia).
                SI NO ENCUENTRAS la información precisa en estas fuentes, tu ÚNICA Y OBLIGATORIA respuesta debe ser: [ADVERTENCIA: DATO NO VERIFICADO. NO SE ENCONTRÓ LA NORMA BOLIVIANA EN LA BASE DE DATOS VIGENTE.]
                No intentes adivinar ni usar conocimiento general.
            `,
        }
      };

      try {
          const response = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
          });
          
          if (searchCancelled.current) return;

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Error en la respuesta del servidor.');
          }

          const data = await response.json();
          setSearchResult(data.text);

      } catch (error) {
          if (searchCancelled.current) return;
          console.error("Error during search:", error);
          showNotification(`Hubo un error durante la búsqueda: ${error.message}`, 'error');
      } finally {
          if (!searchCancelled.current) {
            setIsLoadingSearch(false);
          }
      }
  };
  
  const handleNewAnalysis = () => {
      setText('');
      setAnalysisResult(null);
  };
  
  const handleNewSearch = () => {
      setSearchQuery('');
      setSearchResult('');
  };

  const handleCancelAnalysis = () => {
      analysisCancelled.current = true;
      setIsLoadingAnalysis(false);
  };

  const handleCancelSearch = () => {
      searchCancelled.current = true;
      setIsLoadingSearch(false);
  };

  const copyToClipboard = (textToCopy: string, type: 'text' | 'search') => {
      navigator.clipboard.writeText(textToCopy);
      if (type === 'text') {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      } else {
        setCopiedSearch(true);
        setTimeout(() => setCopiedSearch(false), 2000);
      }
  };

  const getDialColorClass = (score: number) => {
    if (score <= 40) return 'red';
    if (score <= 70) return 'yellow';
    return 'green';
  };
  
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  return (
    <>
      <div className="container">
        <header>
          <h1>Líder Legal (Bolivia)</h1>
          <p>Su asistente legal inteligente. Perfeccione sus documentos legales con análisis de estilo y terminología, y fundamente sus argumentos con búsquedas precisas en la normativa y jurisprudencia de Bolivia.</p>
        </header>

        <main>
          <div className="content-block">
            <h2>1. Editor de Documentos</h2>
            <p className="editor-instructions">Puedes redactar directamente o copiar y pegar el contenido desde un archivo de Word u otro editor de texto.</p>
            <textarea
              className="editor-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escriba, pegue su texto legal o cargue un documento Word de menos de 3000 palabras aquí..."
              disabled={isLoadingAnalysis}
            />
            <div className="editor-footer">
               <p className={`word-counter ${wordCount > WORD_LIMIT ? 'limit-exceeded' : ''}`}>
                 Palabras: {wordCount} / {WORD_LIMIT}
               </p>
              {!analysisResult ? (
                  <div className="btn-group">
                      <button className="btn btn-primary" onClick={handleAnalyze} disabled={isLoadingAnalysis || !text.trim()}>Analizar Texto</button>
                      <label htmlFor="docx-upload" className={`btn btn-secondary ${isLoadingAnalysis ? 'disabled' : ''}`}>
                          Cargar Word (.docx)
                      </label>
                      <input type="file" id="docx-upload" accept=".docx" onChange={handleDocxChange} style={{ display: 'none' }} disabled={isLoadingAnalysis}/>
                  </div>
              ) : (
                  <button className="btn btn-primary" onClick={handleNewAnalysis}>Nuevo Análisis</button>
              )}
            </div>
          </div>
          
            <div className="content-block">
                 <h2>2. Análisis y Herramientas</h2>
                 {isLoadingAnalysis && (
                    <div className="loader-container">
                        <div className="loader"></div>
                        <span>Analizando texto...</span>
                        <button className="btn btn-cancel" onClick={handleCancelAnalysis}>Cancelar</button>
                    </div>
                 )}
                 {!isLoadingAnalysis && !analysisResult && (
                    <p className="analysis-placeholder">Los resultados de su análisis aparecerán aquí.</p>
                 )}
                 {analysisResult && (
                    <>
                        <div className="dial-container">
                             <div className="dial">
                                 <svg viewBox="0 0 120 120" className="dial-svg">
                                    <g transform="rotate(-90, 60, 60)">
                                     <circle className="dial-background" cx="60" cy="60" r={radius} strokeWidth="10" />
                                     <circle 
                                         className={`dial-bar ${getDialColorClass(analysisResult.indiceTecnicidad)}`}
                                         cx="60" cy="60" r={radius} strokeWidth="10"
                                         strokeDasharray={circumference}
                                         strokeDashoffset={circumference - (analysisResult.indiceTecnicidad / 100) * circumference}
                                     />
                                    </g>
                                     <text x="50%" y="50%" className="dial-text">
                                        {analysisResult.indiceTecnicidad}%
                                     </text>
                                 </svg>
                             </div>
                             <p className="dial-label"><b>Índice de Tecnicidad:</b> Una métrica del 1 al 100 que evalúa la formalidad y precisión de su redacción. Un puntaje más alto indica un texto de mayor calidad legal.</p>
                        </div>
                        
                        <h2>Sugerencias de Mejora</h2>
                        <div className="suggestions-list">
                            {analysisResult.sugerencias.map((s, index) => (
                                <div key={index} className={`suggestion-card ${s.severidad === 'Crítica' ? 'critica' : ''}`}>
                                    {s.severidad === 'Crítica' && <span className="suggestion-badge">Alerta de Coherencia</span>}
                                    <p><b>Original:</b> <span className={s.severidad === 'Crítica' ? 'text-critical' : ''}>{s.original}</span></p>
                                    <p><strong>Sugerencia:</strong> {s.sugerencia}</p>
                                    <p><strong>Razón:</strong> {s.razon}</p>
                                </div>
                            ))}
                        </div>
                    </>
                 )}
            </div>
            {analysisResult && (
                 <div className="content-block">
                     <h2>Texto Corregido</h2>
                     <div className="corrected-text-content">{analysisResult.textoCorregido}</div>
                     <div className="btn-group" style={{marginTop: '1rem'}}>
                         <button className={`btn btn-primary ${copiedText ? 'copied' : ''}`} onClick={() => copyToClipboard(analysisResult.textoCorregido, 'text')}>
                           {copiedText ? '¡Copiado!' : 'Copiar Texto'}
                         </button>
                     </div>
                 </div>
            )}

          <div className="content-block">
            <h2>3. Sustanciación y Búsqueda Legal</h2>
            {isLoadingSearch && (
              <div className="loader-container">
                  <div className="loader"></div>
                  <span>Buscando...</span>
                  <button className="btn btn-cancel" onClick={handleCancelSearch}>Cancelar</button>
              </div>
            )}
            {!isLoadingSearch && !searchResult && (
                <>
                    <p className="editor-instructions">Realiza una consulta para encontrar el fundamento normativo o jurisprudencial para tus argumentos.</p>
                    <div className="search-input-group">
                        <input
                            type="text"
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ej: Requisitos para usucapión"
                        />
                        <button className="btn btn-primary" onClick={handleSearch} disabled={!searchQuery.trim()}>Buscar</button>
                    </div>
                </>
            )}
            {!isLoadingSearch && searchResult && (
                 <div className="search-results">
                     <p>{searchResult}</p>
                     <div className="btn-group">
                        <button className={`btn btn-primary ${copiedSearch ? 'copied' : ''}`} onClick={() => copyToClipboard(searchResult, 'search')}>
                          {copiedSearch ? '¡Copiado!' : 'Copiar Texto'}
                        </button>
                        <button className="btn btn-secondary" onClick={handleNewSearch}>Nueva Búsqueda</button>
                     </div>
                 </div>
            )}
          </div>

          <div className="disclaimer-block">
            <p><span className="disclaimer-title">Nota Importante:</span> Líder Legal (Bolivia) es una herramienta de asistencia diseñada para optimizar su tiempo y eficiencia. Sin embargo, no reemplaza el juicio profesional. Es responsabilidad del abogado revisar y verificar la pertinencia de cada normativa, jurisprudencia y sugerencia antes de su uso en documentos oficiales.</p>
          </div>
        </main>
      </div>
      <footer>
        <p>© 2025 Escuela de Líderes - Bolivia</p>
        <p>Dirección: Av. 20 de octubre No. 2034 Piso 1 Of. 103 - WhatsApp +591 79115511</p>
        <div className="visitor-count">
          Usted es el visitante No. <span>{visitorCount}</span>
        </div>
      </footer>
      {notification && (
        <div className={`notification-message ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

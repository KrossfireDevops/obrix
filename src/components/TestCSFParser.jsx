// src/components/TestCSFParser.jsx
import React, { useState } from 'react';
import { extraerTextoPDF, parsearCSF, getSemaforoParsing } from '../services/documentParser.service';

export default function TestCSFParser() {
  const [file, setFile] = useState(null);
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setTexto('');
    setResultado(null);
  };

  const handleParse = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      // Paso 1: Extraer texto nativo
      const textoExtraido = await extraerTextoPDF(file);
      setTexto(textoExtraido.substring(0, 500) + '...'); // Mostrar preview
      
      // Paso 2: Parsear CSF
      const parsed = parsearCSF(textoExtraido);
      setResultado(parsed);
      
      console.log('✅ Texto extraído:', textoExtraido.substring(0, 200));
      console.log('✅ Resultado parsing:', parsed);
      
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error al procesar el documento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', color: '#e2e8f0' }}>
      <h2>🧪 Test Parser CSF Nativo (sin OCR)</h2>
      
      <input 
        type="file" 
        accept=".pdf" 
        onChange={handleFileChange}
        style={{ marginBottom: 20, width: '100%' }}
      />
      
      <button 
        onClick={handleParse} 
        disabled={!file || loading}
        style={{ 
          padding: '12px 24px', 
          backgroundColor: '#C084FC',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          width: '100%',
          fontSize: 16,
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Extrayendo texto...' : 'Extraer y Parsear CSF'}
      </button>

      {texto && (
        <div style={{ marginTop: 20, background: '#1a1a2e', padding: 15, borderRadius: 8 }}>
          <h4>📄 Texto Extraído (Preview)</h4>
          <pre style={{ 
            color: '#94a3b8', 
            maxHeight: 200, 
            overflow: 'auto',
            fontSize: 13,
            whiteSpace: 'pre-wrap'
          }}>
            {texto}
          </pre>
        </div>
      )}

      {resultado && (
        <div style={{ marginTop: 20, background: '#1a1a2e', padding: 20, borderRadius: 8 }}>
          <h3>✅ Resultado del Parsing</h3>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            marginBottom: 20,
            padding: '12px',
            background: resultado.confianza >= 80 ? 'rgba(16, 185, 129, 0.15)' : 
                       resultado.confianza >= 50 ? 'rgba(234, 179, 8, 0.15)' : 
                       'rgba(239, 68, 68, 0.15)',
            borderRadius: 8
          }}>
            <div style={{ 
              fontSize: 24, 
              fontWeight: 'bold',
              color: resultado.confianza >= 80 ? '#10B981' : 
                     resultado.confianza >= 50 ? '#F59E0B' : '#EF4444'
            }}>
              {resultado.confianza}%
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                {getSemaforoParsing(resultado.confianza, resultado.confianza >= 50).label}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 14 }}>
                Tipo CSF: {resultado.datos.tipo_csf}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(resultado.datos).map(([key, value]) => (
              value && (
                <div key={key} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: 6
                }}>
                  <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>
                    {key.replace('_', ' ')}
                  </span>
                  <strong style={{ color: '#60A5FA' }}>{value}</strong>
                </div>
              )
            ))}
          </div>

          {resultado.errores.length > 0 && (
            <div style={{ 
              marginTop: 20, 
              padding: 15, 
              background: 'rgba(239, 68, 68, 0.15)',
              borderLeft: '4px solid #EF4444',
              borderRadius: 4
            }}>
              <h4 style={{ color: '#EF4444', margin: '0 0 8px' }}>⚠️ Errores</h4>
              <ul style={{ color: '#F87171', margin: 0, paddingLeft: 20 }}>
                {resultado.errores.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
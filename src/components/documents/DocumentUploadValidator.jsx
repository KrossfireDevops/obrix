// src/components/documents/DocumentUploadValidator.jsx
// ============================================================================
// 
// ============================================================================
import React, { useState } from "react"
import { parsearDocumento } from "../../services/documentParser.service"

export default function DocumentUploadValidator({
  tipoDocumento,
  rfcEsperado,
  onValidado
}) {

  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = async (file) => {

    setLoading(true)
    setError(null)

    const res = await parsearDocumento(
      file,
      tipoDocumento,
      rfcEsperado
    )

    setLoading(false)

    if (!res.success) {
      setError(res.error)
      return
    }

    setResultado(res.resultado)

    if (onValidado) {
      onValidado(res.resultado)
    }

  }

  const handleChange = e => {

    const file = e.target.files?.[0]
    if (!file) return

    handleFile(file)

  }

  return (

    <div className="document-upload-validator">

      <input
        type="file"
        accept="application/pdf"
        onChange={handleChange}
      />

      {loading && <p>Analizando documento...</p>}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {resultado && (

        <div className="resultado">

          <p>
            Confianza: {resultado.confianza}%
          </p>

          <pre>
            {JSON.stringify(
              resultado.datos_extraidos,
              null,
              2
            )}
          </pre>

        </div>

      )}

    </div>

  )

}
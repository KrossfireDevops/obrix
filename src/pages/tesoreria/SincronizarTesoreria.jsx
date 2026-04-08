// ============================================================
//  OBRIX — Componente: Sincronizar Tesorería con Buzón SAT
//  src/components/tesoreria/SincronizarTesoreria.jsx
//
//  Uso: <SincronizarTesoreria companyId={companyId} onExito={cargarDatos} />
//
//  Llama a la función RPC sincronizar_tesoreria(company_id)
//  que ejecuta los 3 puentes en secuencia:
//    Puente 1: CFDIs emitidos  → tesoreria_cxc
//    Puente 2: CFDIs recibidos → tesoreria_cxp
//    Puente 3: REPs timbrados  → liquidar CxC
// ============================================================
import { useState } from 'react'
import { supabase } from '../../config/supabase'
import {
  RefreshCw, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, FileText, X,
} from 'lucide-react'

const C = {
  borde: 'var(--color-border-tertiary)',
  bg:    'var(--color-background-primary)',
  bgSec: 'var(--color-background-secondary)',
}

// ─── Línea de resultado ──────────────────────────────────────
const FilaResultado = ({ icono, label, creadas, omitidas, canceladas, extra }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '12px 0',
    borderBottom: `0.5px solid ${C.borde}`,
  }}>
    <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icono}</div>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-success)', fontWeight: 500 }}>
          +{creadas} nueva{creadas !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          {omitidas} ya existía{omitidas !== 1 ? 'n' : ''}
        </span>
        {canceladas > 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-text-danger)', fontWeight: 500 }}>
            {canceladas} cancelada{canceladas !== 1 ? 's' : ''}
          </span>
        )}
        {extra && (
          <span style={{ fontSize: 12, color: 'var(--color-text-info)', fontWeight: 500 }}>
            {extra}
          </span>
        )}
      </div>
    </div>
  </div>
)

// ─── Componente principal ────────────────────────────────────
export default function SincronizarTesoreria({ companyId, onExito, variant = 'button' }) {
  const [estado,     setEstado]     = useState('idle')   // idle | cargando | exito | error
  const [resultado,  setResultado]  = useState(null)
  const [error,      setError]      = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  const ejecutar = async () => {
    if (!companyId) return
    setEstado('cargando')
    setError(null)
    setResultado(null)
    setModalAbierto(true)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('sincronizar_tesoreria', { p_company_id: companyId })

      if (rpcError) throw rpcError

      setResultado(data)
      setEstado('exito')

      // Notificar al padre para que recargue sus datos
      if (onExito) onExito(data)

    } catch (e) {
      setError(e.message || 'Error al sincronizar')
      setEstado('error')
    }
  }

  const cerrar = () => {
    setModalAbierto(false)
    // Resetear tras cerrar para poder volver a sincronizar
    setTimeout(() => { setEstado('idle'); setResultado(null); setError(null) }, 300)
  }

  // ── Botón disparador ────────────────────────────────────────
  const Boton = () => (
    <button
      onClick={ejecutar}
      disabled={estado === 'cargando'}
      title="Sincronizar CxC y CxP desde el Buzón Fiscal SAT"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: variant === 'compact' ? '7px 12px' : '8px 16px',
        borderRadius: 'var(--border-radius-md)',
        border: `0.5px solid var(--color-border-info)`,
        backgroundColor: 'var(--color-background-info)',
        color: 'var(--color-text-info)',
        cursor: estado === 'cargando' ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 500,
        opacity: estado === 'cargando' ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <RefreshCw
        size={14}
        style={{ animation: estado === 'cargando' ? 'spin 1s linear infinite' : 'none' }}
      />
      {estado === 'cargando'
        ? 'Sincronizando...'
        : variant === 'compact' ? 'Sincronizar SAT' : 'Sincronizar desde Buzón SAT'
      }
    </button>
  )

  // ── Modal de resultado ──────────────────────────────────────
  const Modal = () => {
    if (!modalAbierto) return null

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.40)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
        <div style={{
          background: C.bg,
          border: `0.5px solid ${C.borde}`,
          borderRadius: 'var(--border-radius-lg)',
          width: '100%', maxWidth: 460,
          animation: 'fadeInDown 0.2s ease',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: `0.5px solid ${C.borde}`,
            backgroundColor: C.bgSec,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                backgroundColor: estado === 'error'
                  ? 'var(--color-background-danger)'
                  : 'var(--color-background-info)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {estado === 'cargando' && <RefreshCw size={16} color="var(--color-text-info)" style={{ animation: 'spin 1s linear infinite' }} />}
                {estado === 'exito'    && <CheckCircle2 size={16} color="var(--color-text-success)" />}
                {estado === 'error'    && <AlertTriangle size={16} color="var(--color-text-danger)" />}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                  Sincronización con Buzón SAT
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>
                  {estado === 'cargando' && 'Procesando CFDIs del Buzón Fiscal...'}
                  {estado === 'exito'    && 'Sincronización completada'}
                  {estado === 'error'    && 'Error en la sincronización'}
                </p>
              </div>
            </div>
            {estado !== 'cargando' && (
              <button onClick={cerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-secondary)' }}>
                <X size={18} />
              </button>
            )}
          </div>

          {/* Cuerpo */}
          <div style={{ padding: '16px 20px' }}>

            {/* Cargando */}
            {estado === 'cargando' && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ width: 36, height: 36, border: `3px solid ${C.borde}`, borderTopColor: 'var(--color-text-info)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>
                  Leyendo CFDIs del Buzón Fiscal...
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>
                  Esto puede tomar unos segundos dependiendo del volumen
                </p>
              </div>
            )}

            {/* Error */}
            {estado === 'error' && (
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--border-radius-md)',
                backgroundColor: 'var(--color-background-danger)',
                border: `0.5px solid var(--color-border-danger)`,
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-danger)', margin: '0 0 4px' }}>
                  No se pudo completar la sincronización
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: 0, opacity: 0.85, lineHeight: 1.4 }}>
                  {error}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-danger)', margin: '8px 0 0', opacity: 0.7 }}>
                  Verifica que el Buzón Fiscal tenga CFDIs descargados y vuelve a intentarlo.
                </p>
              </div>
            )}

            {/* Éxito — resultados */}
            {estado === 'exito' && resultado && (
              <>
                <div style={{ marginBottom: 4 }}>
                  <FilaResultado
                    icono="📈"
                    label="Cuentas por Cobrar (CxC)"
                    creadas={resultado.cxc?.creadas    ?? 0}
                    omitidas={resultado.cxc?.omitidas  ?? 0}
                    canceladas={resultado.cxc?.canceladas ?? 0}
                  />
                  <FilaResultado
                    icono="📉"
                    label="Cuentas por Pagar (CxP)"
                    creadas={resultado.cxp?.creadas    ?? 0}
                    omitidas={resultado.cxp?.omitidas  ?? 0}
                    canceladas={resultado.cxp?.canceladas ?? 0}
                  />
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 0 0',
                  }}>
                    <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>🔗</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
                        REP — Complementos de pago procesados
                      </p>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-success)', fontWeight: 500 }}>
                          {resultado.rep?.liquidadas ?? 0} CxC liquidada{(resultado.rep?.liquidadas ?? 0) !== 1 ? 's' : ''}
                        </span>
                        {(resultado.rep?.parciales ?? 0) > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--color-text-warning)', fontWeight: 500 }}>
                            {resultado.rep?.parciales} cobro parcial
                          </span>
                        )}
                        {(resultado.rep?.sin_match ?? 0) > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                            {resultado.rep?.sin_match} sin CxC vinculada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen ejecutivo */}
                {(resultado.cxc?.creadas > 0 || resultado.cxp?.creadas > 0 || resultado.rep?.liquidadas > 0) && (
                  <div style={{
                    marginTop: 14, padding: '10px 14px',
                    borderRadius: 'var(--border-radius-md)',
                    backgroundColor: 'var(--color-background-success)',
                    border: `0.5px solid var(--color-border-success)`,
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--color-text-success)', margin: 0, fontWeight: 500 }}>
                      ✅ Se crearon {resultado.cxc?.creadas ?? 0} CxC
                      y {resultado.cxp?.creadas ?? 0} CxP nuevas desde el Buzón Fiscal.
                      {resultado.rep?.liquidadas > 0 && ` ${resultado.rep.liquidadas} CxC liquidadas por REP.`}
                    </p>
                  </div>
                )}

                {resultado.cxc?.creadas === 0 && resultado.cxp?.creadas === 0 && resultado.rep?.liquidadas === 0 && (
                  <div style={{
                    marginTop: 14, padding: '10px 14px',
                    borderRadius: 'var(--border-radius-md)',
                    backgroundColor: C.bgSec,
                    border: `0.5px solid ${C.borde}`,
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                      Todo está al día — no hay CFDIs nuevos que sincronizar.
                    </p>
                  </div>
                )}

                {/* Timestamp */}
                {resultado.ejecutado_en && (
                  <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: '12px 0 0', textAlign: 'right' }}>
                    Ejecutado: {new Date(resultado.ejecutado_en).toLocaleString('es-MX')}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {estado !== 'cargando' && (
            <div style={{
              display: 'flex', gap: 10, padding: '14px 20px',
              borderTop: `0.5px solid ${C.borde}`,
            }}>
              <button onClick={cerrar} style={{
                flex: 1, padding: '9px', borderRadius: 'var(--border-radius-md)',
                border: `0.5px solid ${C.borde}`, background: C.bg,
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}>
                Cerrar
              </button>
              {estado === 'exito' && (
                <button onClick={() => { cerrar(); if (onExito) onExito(resultado) }} style={{
                  flex: 1, padding: '9px', borderRadius: 'var(--border-radius-md)',
                  border: 'none', background: 'var(--color-text-primary)',
                  color: 'var(--color-background-primary)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                  Ver CxC y CxP →
                </button>
              )}
              {estado === 'error' && (
                <button onClick={ejecutar} style={{
                  flex: 1, padding: '9px', borderRadius: 'var(--border-radius-md)',
                  border: 'none', background: 'var(--color-text-primary)',
                  color: 'var(--color-background-primary)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Boton />
      <Modal />
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </>
  )
}

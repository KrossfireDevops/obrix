// src/pages/terceros/TercerosList.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast } from '../../hooks/useToast'
import * as service from '../../services/terceros.service'
import {
  Plus, Search, AlertTriangle, CheckCircle, XCircle,
  Shield, Bell, Lock, Unlock, RefreshCw, ChevronDown
} from 'lucide-react'

// ── Score Badge ───────────────────────────────────────────────────────────────
export const ScoreBadge = ({ score, semaforo, size = 'md' }) => {
  const config = {
    verde:    { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7', icon: '🟢' },
    amarillo: { bg: '#FEF9C3', color: '#B45309', border: '#FDE68A', icon: '🟡' },
    rojo:     { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA', icon: '🔴' },
  }
  const c   = config[semaforo] || config.rojo
  const pad = size === 'sm' ? '2px 8px' : '4px 12px'
  const fs  = size === 'sm' ? '11px' : '13px'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: pad, borderRadius: '9999px', fontSize: fs, fontWeight: '700',
      backgroundColor: c.bg, color: c.color,
      border: `1px solid ${c.border}`
    }}>
      {c.icon} {score ?? '—'}
    </span>
  )
}

// ── Bandera Item ──────────────────────────────────────────────────────────────
const BanderaChip = ({ urgencia, count }) => {
  if (!count) return null
  const config = {
    critica: { bg: '#FEE2E2', color: '#991B1B', label: '⛔' },
    alta:    { bg: '#FEE2E2', color: '#B91C1C', label: '🔴' },
    media:   { bg: '#FEF9C3', color: '#B45309', label: '🟡' },
  }
  const c = config[urgencia]
  return (
    <span style={{
      fontSize: '11px', fontWeight: '700', padding: '2px 7px',
      borderRadius: '9999px', backgroundColor: c.bg, color: c.color
    }}>
      {c.label} {count}
    </span>
  )
}

// ── Tipo badge ────────────────────────────────────────────────────────────────
const TipoBadge = ({ tipo }) => {
  const config = {
    proveedor: { bg: '#EFF6FF', color: '#1E40AF', label: 'Proveedor' },
    cliente:   { bg: '#F0FDF4', color: '#065F46', label: 'Cliente'   },
    ambos:     { bg: '#F5F3FF', color: '#5B21B6', label: 'Ambos'     },
  }
  const c = config[tipo] || config.proveedor
  return (
    <span style={{
      fontSize: '11px', fontWeight: '500', padding: '2px 8px',
      borderRadius: '6px', backgroundColor: c.bg, color: c.color
    }}>
      {c.label}
    </span>
  )
}

// ── Nivel completado ──────────────────────────────────────────────────────────
const NivelBadge = ({ nivel }) => (
  <span style={{
    fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px',
    backgroundColor: nivel >= 2 ? '#D1FAE5' : '#F3F4F6',
    color: nivel >= 2 ? '#065F46' : '#6B7280'
  }}>
    {nivel >= 2 ? '⭐ N2' : 'N1'}
  </span>
)

// ── Card de Tercero ───────────────────────────────────────────────────────────
const TerceroCard = ({ tercero, onBloquear, onDesbloquear, onRecalcular }) => {
  const navigate  = useNavigate()
  const relacion  = tercero.tercero_relaciones?.[0] || {}
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      style={{
        backgroundColor: '#fff', border: '1px solid #E5E7EB',
        borderRadius: '12px', padding: '16px', cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        borderLeft: `4px solid ${
          relacion.bloqueado         ? '#DC2626' :
          relacion.score_semaforo === 'verde'    ? '#10B981' :
          relacion.score_semaforo === 'amarillo' ? '#F59E0B' : '#EF4444'
        }`
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      onClick={() => navigate(`/fiscal/terceros/${tercero.id}`)}
    >
      {/* Fila 1: RFC + Score + Acciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E40AF', fontFamily: 'monospace',
            backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>
            {tercero.rfc}
          </span>
          <NivelBadge nivel={tercero.nivel_completado} />
          {relacion.bloqueado && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#991B1B',
              backgroundColor: '#FEE2E2', padding: '2px 8px', borderRadius: '6px' }}>
              🔒 BLOQUEADO
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={e => e.stopPropagation()}>
          <ScoreBadge score={relacion.score_fiscal} semaforo={relacion.score_semaforo} />
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <ChevronDown size={12} color="#6B7280" />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px' }}>
                <button onClick={() => { onRecalcular(tercero.id); setMenuOpen(false) }}
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: '13px',
                    background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={13} /> Recalcular Score
                </button>
                {relacion.bloqueado ? (
                  <button onClick={() => { onDesbloquear(tercero.id); setMenuOpen(false) }}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: '13px',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#059669',
                      display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Unlock size={13} /> Desbloquear
                  </button>
                ) : (
                  <button onClick={() => { onBloquear(tercero.id); setMenuOpen(false) }}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: '13px',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626',
                      display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={13} /> Bloquear
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Razón Social */}
      <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 8px', lineHeight: 1.3 }}>
        {tercero.razon_social}
      </p>

      {/* Meta */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <TipoBadge tipo={relacion.tipo} />
        <span style={{ fontSize: '12px', color: '#6B7280' }}>📍 CP {tercero.codigo_postal}</span>
        <span style={{ fontSize: '12px', color: '#6B7280' }}>🏷️ {tercero.regimen_fiscal}</span>
      </div>

      {/* Banderas */}
      {relacion.tiene_banderas && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '8px',
          borderTop: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: '11px', color: '#6B7280', marginRight: '2px' }}>⚑</span>
          {relacion.banderas_criticas > 0 && <BanderaChip urgencia="critica" count={relacion.banderas_criticas} />}
        </div>
      )}

      {relacion.sello_aprobacion && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px',
          paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
          <CheckCircle size={13} color="#065F46" />
          <span style={{ fontSize: '11px', color: '#065F46', fontWeight: '600' }}>Sello de Aprobación Fiscal</span>
        </div>
      )}
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────
export const TercerosList = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [terceros,    setTerceros]    = useState([])
  const [estadisticas, setEstadisticas] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterTipo,  setFilterTipo]  = useState('')
  const [filterSem,   setFilterSem]   = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [tercerosRes, statsRes] = await Promise.all([
      service.getTerceros(),
      service.getEstadisticasFiscales(),
    ])
    setTerceros(tercerosRes.data   || [])
    setEstadisticas(statsRes.data  || null)
    setLoading(false)
  }

  const loadFiltered = useCallback(async () => {
    setLoading(true)
    const { data } = await service.getTerceros({
      search:   search   || undefined,
      tipo:     filterTipo || undefined,
      semaforo: filterSem  || undefined,
    })
    setTerceros(data || [])
    setLoading(false)
  }, [search, filterTipo, filterSem])

  useEffect(() => {
    const t = setTimeout(loadFiltered, 350)
    return () => clearTimeout(t)
  }, [loadFiltered])

  const handleBloquear = async (terceroId) => {
    const motivo = prompt('Motivo del bloqueo:')
    if (!motivo) return
    const { error } = await service.bloquearTercero(terceroId, motivo)
    if (error) { toast.error('Error al bloquear'); return }
    toast.success('Tercero bloqueado')
    loadData()
  }

  const handleDesbloquear = async (terceroId) => {
    const { error } = await service.desbloquearTercero(terceroId)
    if (error) { toast.error('Error al desbloquear'); return }
    toast.success('Tercero desbloqueado')
    loadData()
  }

  const handleRecalcular = async (terceroId) => {
    const { error } = await service.recalcularScore(terceroId)
    if (error) { toast.error('Error al recalcular'); return }
    toast.success('Score actualizado')
    loadData()
  }

  const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

  return (
    <RequirePermission module="fiscal" action="view">
      <MainLayout title="🏢 Directorio Fiscal de Terceros">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── KPIs ── */}
          {estadisticas && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Total',        value: estadisticas.total,            color: '#1E40AF', bg: '#EFF6FF' },
                { label: '🟢 Verdes',    value: estadisticas.verdes,           color: '#065F46', bg: '#D1FAE5' },
                { label: '🟡 Amarillos', value: estadisticas.amarillos,        color: '#B45309', bg: '#FEF9C3' },
                { label: '🔴 Rojos',     value: estadisticas.rojos,            color: '#991B1B', bg: '#FEE2E2' },
                { label: 'Score Prom.',  value: estadisticas.score_promedio,   color: '#374151', bg: '#F9FAFB' },
                { label: '⚑ Banderas',  value: estadisticas.banderas_criticas + estadisticas.banderas_altas + estadisticas.banderas_medias, color: '#B45309', bg: '#FEF3C7' },
                { label: '🔒 Bloqueados',value: estadisticas.bloqueados,       color: '#991B1B', bg: '#FEE2E2' },
                { label: '32-D Alertas', value: estadisticas.banderas_32d,     color: '#7C3AED', bg: '#EDE9FE' },
              ].map(kpi => (
                <div key={kpi.label} style={{ backgroundColor: kpi.bg, borderRadius: '10px',
                  padding: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '22px', fontWeight: '800', color: kpi.color, margin: '0 0 3px' }}>{fmt(kpi.value)}</p>
                  <p style={{ fontSize: '11px', color: kpi.color, margin: 0, opacity: 0.8 }}>{kpi.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              {terceros.length} tercero{terceros.length !== 1 ? 's' : ''} en directorio
            </p>
            <button onClick={() => navigate('/fiscal/terceros/nuevo')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                borderRadius: '10px', border: 'none', backgroundColor: '#1E40AF',
                color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              <Plus size={16} /> Nuevo Tercero
            </button>
          </div>

          {/* ── Filtros ── */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', backgroundColor: '#fff',
            border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%',
                transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input type="text" placeholder="RFC o Razón Social..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px',
                  paddingTop: '8px', paddingBottom: '8px', border: '1px solid #E5E7EB',
                  borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px',
                fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}>
              <option value="">Todos los tipos</option>
              <option value="proveedor">Proveedores</option>
              <option value="cliente">Clientes</option>
              <option value="ambos">Ambos</option>
            </select>
            <select value={filterSem} onChange={e => setFilterSem(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px',
                fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}>
              <option value="">Todos los semáforos</option>
              <option value="verde">🟢 Verde</option>
              <option value="amarillo">🟡 Amarillo</option>
              <option value="rojo">🔴 Rojo</option>
            </select>
          </div>

          {/* ── Lista ── */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <div style={{ width: '36px', height: '36px', border: '3px solid #E5E7EB',
                borderTopColor: '#1E40AF', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : terceros.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px', backgroundColor: '#fff',
              borderRadius: '12px', border: '1px solid #E5E7EB' }}>
              <Shield size={44} style={{ margin: '0 auto 12px', color: '#D1D5DB' }} />
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#374151', margin: '0 0 6px' }}>
                Sin terceros en el directorio
              </p>
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 16px' }}>
                Agrega tu primer cliente o proveedor para comenzar la validación fiscal
              </p>
              <button onClick={() => navigate('/fiscal/terceros/nuevo')}
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none',
                  backgroundColor: '#1E40AF', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                + Nuevo Tercero
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px,1fr))', gap: '12px' }}>
              {terceros.map(t => (
                <TerceroCard key={t.id} tercero={t}
                  onBloquear={handleBloquear}
                  onDesbloquear={handleDesbloquear}
                  onRecalcular={handleRecalcular}
                />
              ))}
            </div>
          )}
        </div>
      </MainLayout>
    </RequirePermission>
  )
}
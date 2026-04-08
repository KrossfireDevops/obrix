// src/services/reports.service.js
import { supabase } from '../config/supabase'
import * as attendanceService from './attendance.service'

// ============================================================================
// REPORTES DE INVENTARIO Y MOVIMIENTOS
// ============================================================================

export const getStockByWarehouse = async () => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        *,
        materials_catalog (material_type, category, subcategory, default_unit),
        warehouses (name, code, projects (name))
      `)
      // ✅ FIX REAL: companies (name) eliminado — no existe relación warehouses → companies
      .order('warehouses(name)', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting stock by warehouse:', error)
    return { data: null, error }
  }
}

export const getMovementsByDateRange = async (startDate, endDate, warehouseId = null) => {
  try {
    let query = supabase
      .from('movements')
      .select(`
        *,
        materials_catalog (material_type, category, subcategory, default_unit),
        warehouses (name, code, projects (name))
      `)
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59.999Z`)

    if (warehouseId) query = query.eq('warehouse_id', warehouseId)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting movements:', error)
    return { data: null, error }
  }
}

export const getTopMaterials = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('movements')
      .select(`material_id, type, quantity, materials_catalog (material_type, category, subcategory, default_unit)`)

    if (error) throw error

    const materialStats = {}
    data.forEach(m => {
      const id = m.material_id
      if (!materialStats[id]) {
        materialStats[id] = {
          material_type: m.materials_catalog?.material_type || 'Sin Nombre',
          category: m.materials_catalog?.category || 'Sin Categoría',
          subcategory: m.materials_catalog?.subcategory || '-',
          unit: m.materials_catalog?.default_unit || 'Pieza',
          movimientos: 0, entradas: 0, salidas: 0
        }
      }
      materialStats[id].movimientos += 1
      if (m.type === 'ENTRADA') materialStats[id].entradas += parseFloat(m.quantity || 0)
      else materialStats[id].salidas += parseFloat(m.quantity || 0)
    })

    const topMaterials = Object.values(materialStats)
      .sort((a, b) => b.movimientos - a.movimientos)
      .slice(0, limit)

    return { data: topMaterials, error: null }
  } catch (error) {
    console.error('Error getting top materials:', error)
    return { data: null, error }
  }
}

export const getLossesReport = async (startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('movements')
      .select(`*, materials_catalog (material_type, category), warehouses (name, code)`)
      .in('type', ['DAÑO', 'DESPERDICIO', 'PERDIDA'])
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59.999Z`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting losses report:', error)
    return { data: null, error }
  }
}

export const getExecutiveSummary = async () => {
  try {
    const { data: inventoryData } = await supabase.from('inventory').select('quantity')
    const { data: movementsData } = await supabase.from('movements').select('type')
    const { count: warehousesCount } = await supabase.from('warehouses').select('id', { count: 'exact' })
    const { count: materialsCount } = await supabase.from('materials_catalog').select('id', { count: 'exact' })

    const totalStock = inventoryData?.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0) || 0
    const movimientosPorTipo = movementsData?.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1
      return acc
    }, {}) || {}

    return {
      data: {
        totalMateriales: materialsCount || 0,
        totalMovimientos: movementsData?.length || 0,
        totalStock,
        totalAlmacenes: warehousesCount || 0,
        movimientosPorTipo,
        fechaGeneracion: new Date().toLocaleString('es-MX')
      },
      error: null
    }
  } catch (error) {
    console.error('Error getting executive summary:', error)
    return { data: null, error }
  }
}

// ============================================================================
// REPORTES DE ASISTENCIA (INTEGRACIÓN MÓDULO ASISTENCIA)
// ============================================================================

export const getAttendanceReport = async (startDate, endDate, filters = {}) => {
  try {
    const { data, error } = await attendanceService.getAttendanceReport(startDate, endDate, filters)
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting attendance report:', error)
    return { data: null, error }
  }
}

export const getAttendanceStats = async (startDate, endDate, companyId = null, projectId = null) => {
  try {
    const { data, error } = await attendanceService.getAttendanceStats(startDate, endDate, companyId, projectId)
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting attendance stats:', error)
    return { data: null, error }
  }
}

export const getAttendanceByProject = async (projectId, startDate, endDate) => {
  try {
    const { data, error } = await attendanceService.getAttendance({ projectId, startDate, endDate })
    if (error) throw error

    const stats = {
      projectName: data[0]?.personnel?.projects?.name || 'Sin Proyecto',
      totalAsistencias: data.filter(r => r.status === 'ASISTENCIA').length,
      totalFaltas: data.filter(r => r.status === 'FALTA').length,
      porDia: {},
      porPersona: {}
    }

    data.forEach(record => {
      const date = record.attendance_date
      if (!stats.porDia[date]) stats.porDia[date] = { asistencias: 0, faltas: 0 }
      if (record.status === 'ASISTENCIA') stats.porDia[date].asistencias++
      else stats.porDia[date].faltas++

      const personId = record.personnel_id
      const personName = `${record.personnel?.first_names || ''} ${record.personnel?.last_names || ''}`.trim()
      if (!stats.porPersona[personId]) {
        stats.porPersona[personId] = {
          name: personName,
          position: record.personnel?.position || 'Sin Puesto',
          asistencias: 0, faltas: 0
        }
      }
      if (record.status === 'ASISTENCIA') stats.porPersona[personId].asistencias++
      else stats.porPersona[personId].faltas++
    })

    return { data: stats, error: null }
  } catch (error) {
    console.error('Error getting attendance by project:', error)
    return { data: null, error }
  }
}

export const getAttendanceSummary = async (startDate, endDate) => {
  try {
    const { data, error } = await attendanceService.getAttendance({ startDate, endDate })
    if (error) throw error

    const summary = {
      totalRegistros: data.length,
      totalAsistencias: data.filter(r => r.status === 'ASISTENCIA').length,
      totalFaltas: data.filter(r => r.status === 'FALTA').length,
      porProyecto: {},
      porPuesto: {},
      fechaGeneracion: new Date().toLocaleString('es-MX')
    }

    summary.porcentajeAsistencia = summary.totalRegistros > 0
      ? ((summary.totalAsistencias / summary.totalRegistros) * 100).toFixed(2)
      : 0

    data.forEach(record => {
      const projectId = record.personnel?.project_id || 'Sin Proyecto'
      const projectName = record.personnel?.projects?.name || 'Sin Proyecto'
      if (!summary.porProyecto[projectId]) summary.porProyecto[projectId] = { name: projectName, asistencias: 0, faltas: 0 }
      if (record.status === 'ASISTENCIA') summary.porProyecto[projectId].asistencias++
      else summary.porProyecto[projectId].faltas++

      const position = record.personnel?.position || 'Sin Puesto'
      if (!summary.porPuesto[position]) summary.porPuesto[position] = { asistencias: 0, faltas: 0 }
      if (record.status === 'ASISTENCIA') summary.porPuesto[position].asistencias++
      else summary.porPuesto[position].faltas++
    })

    return { data: summary, error: null }
  } catch (error) {
    console.error('Error getting attendance summary:', error)
    return { data: null, error }
  }
}

export const getAttendanceForExport = async (startDate, endDate, filters = {}) => {
  try {
    const { data, error } = await attendanceService.getAttendance({ startDate, endDate, ...filters })
    if (error) throw error

    const formattedData = data.map(record => ({
      fecha: record.attendance_date,
      horaRegistro: record.check_in_time
        ? new Date(record.check_in_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : '-',
      nombre: `${record.personnel?.first_names || ''} ${record.personnel?.last_names || ''}`.trim(),
      puesto: record.personnel?.position || 'Sin Puesto',
      empresa: record.personnel?.company_name || 'Sin Empresa',
      proyecto: record.personnel?.projects?.name || 'Sin Proyecto',
      estado: record.status,
      almacen: record.warehouses?.name || '-',
      observaciones: record.observations || '-'
    }))

    return { data: formattedData, error: null }
  } catch (error) {
    console.error('Error getting attendance for export:', error)
    return { data: null, error }
  }
}

// ============================================================================
// REPORTES DE AVANCE DE PROYECTOS
// ============================================================================

export const getProjectsProgress = async () => {
  try {
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, project_type, status, budget, start_date, end_date')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (projectsError) throw projectsError

    const results = []

    for (const project of projects) {
      const { data: nodes, error: nodesError } = await supabase
        .from('project_nodes')
        .select('id, name, progress_percent, status, parent_id, level, sort_order')
        .eq('project_id', project.id)
        .eq('is_active', true)
        .order('level',      { ascending: true })
        .order('sort_order', { ascending: true })

      if (nodesError) throw nodesError

      const totalNodes  = nodes?.length || 0
      const completados = nodes?.filter(n => n.status === 'COMPLETADO').length  || 0
      const enProgreso  = nodes?.filter(n => n.status === 'EN_PROGRESO').length || 0
      const pendientes  = nodes?.filter(n => n.status === 'PENDIENTE').length   || 0
      const bloqueados  = nodes?.filter(n => n.status === 'BLOQUEADO').length   || 0

      const avgProgress = totalNodes > 0
        ? Math.round(nodes.reduce((sum, n) => sum + parseFloat(n.progress_percent || 0), 0) / totalNodes)
        : 0

      // Nodos raíz (nivel 0) para mostrar desglose por sección
      const rootNodes = nodes?.filter(n => n.parent_id === null) || []

      results.push({
        ...project,
        totalNodes,
        completados,
        enProgreso,
        pendientes,
        bloqueados,
        avgProgress,
        rootNodes
      })
    }

    return { data: results, error: null }
  } catch (error) {
    console.error('Error getting projects progress:', error)
    return { data: null, error }
  }
}

export const getNodesByProjectReport = async (projectId) => {
  try {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, project_type, status, budget')
      .eq('id', projectId)
      .single()

    if (projectError) throw projectError

    const { data: nodes, error: nodesError } = await supabase
      .from('project_nodes')
      .select(`
        id, name, code, node_type, level, sort_order,
        progress_percent, status, is_validated,
        responsible_name, parent_id, attachments
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('level',      { ascending: true })
      .order('sort_order', { ascending: true })

    if (nodesError) throw nodesError

    // Construir breadcrumb para cada nodo
    const nodeMap = {}
    nodes.forEach(n => { nodeMap[n.id] = n })

    const getBreadcrumb = (node) => {
      const parts = []
      let current = node
      while (current) {
        parts.unshift(current.name)
        current = current.parent_id ? nodeMap[current.parent_id] : null
      }
      return parts.join(' > ')
    }

    const nodesWithBreadcrumb = nodes.map(n => ({
      ...n,
      breadcrumb: getBreadcrumb(n),
      attachmentsCount: Array.isArray(n.attachments) ? n.attachments.length : 0
    }))

    return { data: { project, nodes: nodesWithBreadcrumb }, error: null }
  } catch (error) {
    console.error('Error getting nodes report:', error)
    return { data: null, error }
  }
}
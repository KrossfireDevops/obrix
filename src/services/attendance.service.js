// src/services/attendance.service.js
import { supabase } from '../config/supabase'

// ============================================================================
// PERSONNEL (Personal en Obra)
// ============================================================================

export const getPersonnel = async (filters = {}) => {
  try {
    let query = supabase
      .from('personnel')
      .select(`
        *,
        projects ( id, name, code ),
        companies ( name )
      `)
      .eq('is_active', filters.isActive ?? true)

    if (filters.companyId) {
      query = query.eq('company_id', filters.companyId)
    }

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }

    if (filters.search) {
      query = query.or(`first_names.ilike.%${filters.search}%,last_names.ilike.%${filters.search}%`)
    }

    if (filters.position) {
      query = query.eq('position', filters.position)
    }

    const { data, error } = await query.order('last_names', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting personnel:', error)
    return { data: null, error }
  }
}

export const getPersonnelByProject = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('personnel')
      .select(`
        *,
        projects ( name, code ),
        companies ( name )
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('last_names', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting personnel by project:', error)
    return { data: null, error }
  }
}

export const getPersonnelById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('personnel')
      .select(`
        *,
        projects ( name, code ),
        companies ( name )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting personnel by id:', error)
    return { data: null, error }
  }
}

export const createPersonnel = async (personnelData) => {
  try {
    if (!personnelData.project_id) {
      throw new Error('El proyecto es obligatorio para registrar personal')
    }
    if (!personnelData.company_id) {
      throw new Error('La empresa es obligatoria para registrar personal')
    }

    const { data, error } = await supabase
      .from('personnel')
      .insert([{
        ...personnelData,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }])
      .select(`
        *,
        projects ( name, code ),
        companies ( name )
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating personnel:', error)
    return { data: null, error }
  }
}

export const updatePersonnel = async (id, personnelData) => {
  try {
    const { data, error } = await supabase
      .from('personnel')
      .update({
        ...personnelData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        projects ( name, code ),
        companies ( name )
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating personnel:', error)
    return { data: null, error }
  }
}

export const deletePersonnel = async (id) => {
  try {
    const { data, error } = await supabase
      .from('personnel')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error deleting personnel:', error)
    return { data: null, error }
  }
}

// ============================================================================
// ATTENDANCE (Asistencia)
// ============================================================================

export const getAttendance = async (filters = {}) => {
  try {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        personnel (
          id,
          first_names,
          last_names,
          position,
          company_id,
          company_name,
          project_id,
          projects ( name, code )
        ),
        warehouses ( name )
      `)

    if (filters.attendanceDate) {
      query = query.eq('attendance_date', filters.attendanceDate)
    }

    if (filters.startDate && filters.endDate) {
      query = query.gte('attendance_date', filters.startDate).lte('attendance_date', filters.endDate)
    }

    if (filters.personnelId) {
      query = query.eq('personnel_id', filters.personnelId)
    }

    if (filters.companyId) {
      query = query.eq('company_id', filters.companyId)
    }

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.warehouseId) {
      query = query.eq('warehouse_id', filters.warehouseId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting attendance:', error)
    return { data: null, error }
  }
}

export const getAttendanceByDate = async (date, personnelId) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        personnel (
          first_names,
          last_names,
          position,
          project_id
        )
      `)
      .eq('attendance_date', date)
      .eq('personnel_id', personnelId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting attendance by date:', error)
    return { data: null, error }
  }
}

export const registerAttendance = async (attendanceData) => {
  try {
    if (!attendanceData.project_id) {
      throw new Error('El proyecto es obligatorio para registrar asistencia')
    }

    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        ...attendanceData,
        check_in_time: attendanceData.status === 'ASISTENCIA' ? new Date().toISOString() : null,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }])
      .select(`
        *,
        personnel (
          first_names,
          last_names,
          position,
          projects ( name )
        ),
        projects ( name, code )
      `)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error registering attendance:', error)
    return { data: null, error }
  }
}

export const updateAttendance = async (id, attendanceData) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .update({
        ...attendanceData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating attendance:', error)
    return { data: null, error }
  }
}

export const deleteAttendance = async (id) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error deleting attendance:', error)
    return { data: null, error }
  }
}

// ============================================================================
// PROJECTS (Para cargar proyectos disponibles)
// ============================================================================

export const getProjects = async (companyId = null) => {
  try {
    let query = supabase
      .from('projects')
      .select(`
        *,
        companies ( name )
      `)
      .eq('is_active', true)
      .eq('status', 'active')

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting projects:', error)
    return { data: null, error }
  }
}

// ============================================================================
// REPORTS (Para módulo de Reportes)
// ============================================================================

export const getAttendanceStats = async (startDate, endDate, companyId = null, projectId = null) => {
  try {
    let query = supabase
      .from('attendance')
      .select(`
        attendance_date,
        status,
        personnel (
          company_id,
          project_id,
          position
        )
      `)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (companyId) {
      query = query.eq('personnel.company_id', companyId)
    }

    if (projectId) {
      query = query.eq('personnel.project_id', projectId)
    }

    const { data, error } = await query

    if (error) throw error

    const stats = {
      totalAsistencias: data.filter(r => r.status === 'ASISTENCIA').length,
      totalFaltas: data.filter(r => r.status === 'FALTA').length,
      porDia: {},
      porPuesto: {},
      porProyecto: {}
    }

    data.forEach(record => {
      const date = record.attendance_date
      if (!stats.porDia[date]) {
        stats.porDia[date] = { asistencias: 0, faltas: 0 }
      }
      if (record.status === 'ASISTENCIA') {
        stats.porDia[date].asistencias++
      } else {
        stats.porDia[date].faltas++
      }

      const position = record.personnel?.position || 'Sin Puesto'
      if (!stats.porPuesto[position]) {
        stats.porPuesto[position] = { asistencias: 0, faltas: 0 }
      }
      if (record.status === 'ASISTENCIA') {
        stats.porPuesto[position].asistencias++
      } else {
        stats.porPuesto[position].faltas++
      }

      const projectId = record.personnel?.project_id || 'Sin Proyecto'
      if (!stats.porProyecto[projectId]) {
        stats.porProyecto[projectId] = { asistencias: 0, faltas: 0 }
      }
      if (record.status === 'ASISTENCIA') {
        stats.porProyecto[projectId].asistencias++
      } else {
        stats.porProyecto[projectId].faltas++
      }
    })

    return { data: stats, error: null }
  } catch (error) {
    console.error('Error getting attendance stats:', error)
    return { data: null, error }
  }
}

export const getAttendanceReport = async (startDate, endDate, filters = {}) => {
  try {
    const { data, error } = await getAttendance({
      startDate,
      endDate,
      ...filters
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting attendance report:', error)
    return { data: null, error }
  }
}
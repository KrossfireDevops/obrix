// ============================================================
//  OBRIX ERP — Servicio: Planeación de Obra
//  src/services/planeacionObra.service.js  |  v1.0
// ============================================================

import { supabase } from '../config/supabase'

// ── Catálogo de niveles ──────────────────────────────────────
export const CATALOGO_NIVELES = [
  { num: -1, nombre: 'Sótano'  },
  { num:  0, nombre: 'PB'      },
  { num:  1, nombre: 'PA'      },
  { num:  2, nombre: 'P1'      },
  { num:  3, nombre: 'P2'      },
  { num:  4, nombre: 'P3'      },
  { num:  5, nombre: 'P4'      },
  { num:  6, nombre: 'P5'      },
  { num:  7, nombre: 'P6'      },
  { num:  8, nombre: 'P7'      },
  { num:  9, nombre: 'P8'      },
  { num: 10, nombre: 'P9'      },
  { num: 11, nombre: 'P10'     },
  { num: 12, nombre: 'PH'      },
  { num: 13, nombre: 'Azotea'  },
]

async function getCompanyId() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id, id')
    .eq('id', user.id)
    .single()
  return { companyId: data?.company_id, userId: data?.id }
}

// ============================================================
//  NIVELES
// ============================================================

export async function getLevelsByProject(projectId) {
  const { data, error } = await supabase
    .from('project_levels')
    .select(`
      *,
      project_sections(
        id, section_code, nombre, status,
        progress_pct, is_validated, responsible_name, sort_order
      )
    `)
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  // Ordenar secciones dentro de cada nivel
  return (data ?? []).map(l => ({
    ...l,
    project_sections: (l.project_sections ?? [])
      .sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function createLevel({ projectId, nivelNum, nivelNombre, sortOrder }) {
  const { companyId } = await getCompanyId()
  const { data, error } = await supabase
    .from('project_levels')
    .insert({
      project_id:   projectId,
      company_id:   companyId,
      nivel_num:    nivelNum,
      nivel_nombre: nivelNombre,
      sort_order:   sortOrder ?? nivelNum + 1, // offset para sótano (-1)
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLevel(id, changes) {
  const { data, error } = await supabase
    .from('project_levels')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLevel(id) {
  const { error } = await supabase
    .from('project_levels')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Crear múltiples niveles a la vez (usado en el wizard)
export async function createLevelesBatch(projectId, niveles) {
  const { companyId } = await getCompanyId()
  const rows = niveles.map((n, i) => ({
    project_id:   projectId,
    company_id:   companyId,
    nivel_num:    n.num,
    nivel_nombre: n.nombre,
    sort_order:   i,
  }))
  const { data, error } = await supabase
    .from('project_levels')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}


// ============================================================
//  SECCIONES
// ============================================================

export async function getSectionsByLevel(levelId) {
  const { data, error } = await supabase
    .from('project_sections')
    .select('*')
    .eq('level_id', levelId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createSection({
  projectId, levelId, nombre, responsibleName,
  descripcion, sortOrder, projectCode, nivelNum,
}) {
  const { companyId } = await getCompanyId()

  // Generar section_code via función SQL
  const { data: codeData, error: codeErr } = await supabase
    .rpc('generate_section_code', {
      p_project_id:   projectId,
      p_nivel_num:    nivelNum,
      p_project_code: projectCode,
    })
  if (codeErr) throw codeErr

  const { data, error } = await supabase
    .from('project_sections')
    .insert({
      project_id:       projectId,
      level_id:         levelId,
      company_id:       companyId,
      section_code:     codeData,
      nombre:           nombre.trim().slice(0, 65),
      responsible_name: responsibleName ?? null,
      descripcion:      descripcion ?? null,
      sort_order:       sortOrder ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSection(id, changes) {
  const { data, error } = await supabase
    .from('project_sections')
    .update({
      ...changes,
      nombre: changes.nombre?.trim().slice(0, 65),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSection(id) {
  const { error } = await supabase
    .from('project_sections')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function updateProgress(sectionId, pct) {
  const { data, error } = await supabase
    .from('project_sections')
    .update({
      progress_pct: Math.min(100, Math.max(0, pct)),
      status: pct >= 100 ? 'COMPLETADO' : pct > 0 ? 'EN_PROGRESO' : 'PENDIENTE',
    })
    .eq('id', sectionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function validateSection(sectionId, notes, userId) {
  const { data, error } = await supabase
    .from('project_sections')
    .update({
      is_validated:     true,
      validated_at:     new Date().toISOString(),
      validated_by:     userId,
      validation_notes: notes ?? null,
      status:           'COMPLETADO',
      progress_pct:     100,
    })
    .eq('id', sectionId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Crear secciones en batch (wizard o replicar)
export async function createSectionsBatch(sections) {
  const { companyId } = await getCompanyId()
  const rows = sections.map(s => ({
    ...s,
    company_id: companyId,
    nombre:     s.nombre.trim().slice(0, 65),
  }))
  const { data, error } = await supabase
    .from('project_sections')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}

// Replicar secciones de un nivel a otros niveles
export async function replicarSecciones(sourceLevelId, targetLevelIds, projectId, projectCode) {
  const { companyId } = await getCompanyId()

  // Obtener secciones origen
  const sourceSections = await getSectionsByLevel(sourceLevelId)
  if (!sourceSections.length) return []

  // Obtener niveles destino
  const { data: targetLevels } = await supabase
    .from('project_levels')
    .select('id, nivel_num, nivel_nombre')
    .in('id', targetLevelIds)

  const allNew = []
  for (const tl of (targetLevels ?? [])) {
    for (let i = 0; i < sourceSections.length; i++) {
      const s = sourceSections[i]
      const { data: newCode } = await supabase.rpc('generate_section_code', {
        p_project_id:   projectId,
        p_nivel_num:    tl.nivel_num,
        p_project_code: projectCode,
      })
      allNew.push({
        project_id:       projectId,
        level_id:         tl.id,
        company_id:       companyId,
        section_code:     newCode,
        nombre:           s.nombre,
        responsible_name: s.responsible_name,
        descripcion:      s.descripcion,
        sort_order:       i,
      })
    }
  }

  if (!allNew.length) return []
  const { data, error } = await supabase
    .from('project_sections')
    .insert(allNew)
    .select()
  if (error) throw error
  return data
}

// Stats del proyecto
export async function getProjectStats(projectId) {
  const { data, error } = await supabase
    .rpc('get_project_stats', { p_project_id: projectId })
  if (error) throw error
  return data?.[0] ?? {}
}
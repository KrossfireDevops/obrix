// src/services/projectNodes.service.js
import { supabase } from '../config/supabase'

// ============================================================================
// TEMPLATES DE ESTRUCTURA POR TIPO DE PROYECTO
// ============================================================================
export const PROJECT_TEMPLATES = {
  RESIDENCIAL: [
    { name: 'Sótano',       node_type: 'nivel', sort_order: 0 },
    { name: 'Planta Baja',  node_type: 'nivel', sort_order: 1 },
    { name: 'Planta Alta',  node_type: 'nivel', sort_order: 2 },
    { name: 'Terraza',      node_type: 'nivel', sort_order: 3 },
    { name: 'Azotea',       node_type: 'nivel', sort_order: 4 },
  ],
  EDIFICIO: [
    { name: 'Nivel -2',  node_type: 'nivel', sort_order: 0 },
    { name: 'Nivel -1',  node_type: 'nivel', sort_order: 1 },
    { name: 'Nivel 1',   node_type: 'nivel', sort_order: 2 },
    { name: 'Nivel 2',   node_type: 'nivel', sort_order: 3 },
    { name: 'Nivel 3',   node_type: 'nivel', sort_order: 4 },
    { name: 'Azotea',    node_type: 'nivel', sort_order: 5 },
  ],
  INDUSTRIAL: [
    { name: 'Patio de Maniobras', node_type: 'zona',  sort_order: 0 },
    { name: 'Estacionamiento',    node_type: 'zona',  sort_order: 1 },
    { name: 'Nave Principal',     node_type: 'nave',  sort_order: 2 },
    { name: 'Oficinas',           node_type: 'zona',  sort_order: 3 },
    { name: 'Almacén',            node_type: 'zona',  sort_order: 4 },
  ],
}

// ============================================================================
// PROYECTOS
// ============================================================================

export const getProjects = async () => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting projects:', error)
    return { data: null, error }
  }
}

export const getProjectById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting project:', error)
    return { data: null, error }
  }
}

export const createProject = async (projectData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('projects')
      .insert([{ ...projectData, created_by: user?.id }])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating project:', error)
    return { data: null, error }
  }
}

export const updateProject = async (id, projectData) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...projectData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating project:', error)
    return { data: null, error }
  }
}

export const deleteProject = async (id) => {
  try {
    const { error } = await supabase
      .from('projects')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting project:', error)
    return { error }
  }
}

// ============================================================================
// NODOS DEL ÁRBOL
// ============================================================================

export const getNodesByProject = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('project_nodes')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting nodes:', error)
    return { data: null, error }
  }
}

export const createNode = async (nodeData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('project_nodes')
      .insert([{ ...nodeData, created_by: user?.id }])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating node:', error)
    return { data: null, error }
  }
}

export const updateNode = async (id, nodeData) => {
  try {
    const { data, error } = await supabase
      .from('project_nodes')
      .update({ ...nodeData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating node:', error)
    return { data: null, error }
  }
}

export const deleteNode = async (id) => {
  try {
    const { error } = await supabase
      .from('project_nodes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting node:', error)
    return { error }
  }
}

export const validateNode = async (id, notes = '') => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('project_nodes')
      .update({
        is_validated: true,
        validated_by: user?.id,
        validated_at: new Date().toISOString(),
        validation_notes: notes,
        status: 'COMPLETADO',
        progress_percent: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error validating node:', error)
    return { data: null, error }
  }
}

export const updateNodeProgress = async (id, progress) => {
  try {
    const status = progress === 0
      ? 'PENDIENTE'
      : progress === 100
        ? 'COMPLETADO'
        : 'EN_PROGRESO'

    const { data, error } = await supabase
      .from('project_nodes')
      .update({
        progress_percent: progress,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating progress:', error)
    return { data: null, error }
  }
}

// ============================================================================
// ADJUNTOS (Fotos / Documentos)
// ============================================================================

export const uploadAttachment = async (nodeId, file) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const path = `project-nodes/${nodeId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(path, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(path)

    // Agregar al array de attachments del nodo
    const { data: node } = await supabase
      .from('project_nodes')
      .select('attachments')
      .eq('id', nodeId)
      .single()

    const newAttachment = {
      url: publicUrl,
      name: file.name,
      type: file.type,
      path,
      uploaded_at: new Date().toISOString(),
      uploaded_by: user?.id
    }

    const updatedAttachments = [...(node?.attachments || []), newAttachment]

    const { data, error } = await supabase
      .from('project_nodes')
      .update({ attachments: updatedAttachments, updated_at: new Date().toISOString() })
      .eq('id', nodeId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error uploading attachment:', error)
    return { data: null, error }
  }
}

export const deleteAttachment = async (nodeId, attachmentPath, attachments) => {
  try {
    await supabase.storage.from('attachments').remove([attachmentPath])

    const updatedAttachments = attachments.filter(a => a.path !== attachmentPath)

    const { data, error } = await supabase
      .from('project_nodes')
      .update({ attachments: updatedAttachments, updated_at: new Date().toISOString() })
      .eq('id', nodeId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return { data: null, error }
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

// Convierte lista plana de nodos → árbol jerárquico
export const buildTree = (nodes) => {
  const map = {}
  const roots = []

  nodes.forEach(node => {
    map[node.id] = { ...node, children: [] }
  })

  nodes.forEach(node => {
    if (node.parent_id && map[node.parent_id]) {
      map[node.parent_id].children.push(map[node.id])
    } else {
      roots.push(map[node.id])
    }
  })

  return roots
}

// Aplica template de estructura inicial a un proyecto
export const applyTemplate = async (projectId, projectType) => {
  const template = PROJECT_TEMPLATES[projectType] || []
  const results = []

  for (const nodeTemplate of template) {
    const { data, error } = await createNode({
      project_id: projectId,
      parent_id: null,
      level: 0,
      ...nodeTemplate
    })
    if (!error) results.push(data)
  }

  return results
}
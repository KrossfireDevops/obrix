// src/components/ui/Pagination.jsx

export const Pagination = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }) => {
  if (totalPages <= 1) return null

  const from = (currentPage - 1) * itemsPerPage + 1
  const to   = Math.min(currentPage * itemsPerPage, totalItems)

  // Generar rango de páginas visibles (máx 5)
  const getPageNumbers = () => {
    const pages = []
    let start = Math.max(1, currentPage - 2)
    let end   = Math.min(totalPages, start + 4)
    if (end - start < 4) start = Math.max(1, end - 4)

    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  const btnBase = {
    minWidth: '36px',
    height: '36px',
    padding: '0 8px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s'
  }

  const btnActive = {
    ...btnBase,
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    color: '#ffffff'
  }

  const btnDisabled = {
    ...btnBase,
    opacity: 0.4,
    cursor: 'not-allowed'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 0 4px',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Info: mostrando X - Y de Z */}
      <span style={{ fontSize: '13px', color: '#6b7280' }}>
        Mostrando <strong>{from}</strong> – <strong>{to}</strong> de <strong>{totalItems}</strong> registros
      </span>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Primera página */}
        <button
          style={currentPage === 1 ? btnDisabled : btnBase}
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="Primera página"
        >«</button>

        {/* Anterior */}
        <button
          style={currentPage === 1 ? btnDisabled : btnBase}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Página anterior"
        >‹</button>

        {/* Números de página */}
        {getPageNumbers().map((page) => (
          <button
            key={page}
            style={page === currentPage ? btnActive : btnBase}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}

        {/* Siguiente */}
        <button
          style={currentPage === totalPages ? btnDisabled : btnBase}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Página siguiente"
        >›</button>

        {/* Última página */}
        <button
          style={currentPage === totalPages ? btnDisabled : btnBase}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Última página"
        >»</button>
      </div>
    </div>
  )
}
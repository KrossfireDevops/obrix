export const Input = ({ 
  label, 
  error, 
  type = 'text', 
  className = '', 
  ...props 
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg 
          bg-white text-gray-900 placeholder-gray-400
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
          outline-none transition-all duration-200
          disabled:bg-gray-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''} 
          ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
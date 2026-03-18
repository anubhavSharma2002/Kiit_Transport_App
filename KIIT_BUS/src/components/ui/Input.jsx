import React from 'react';

const Input = ({ label, error, icon: Icon, className = '', ...props }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-700 ml-1">
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon size={18} />
          </div>
        )}

        <input
          className={`
            w-full
            bg-slate-50
            border border-slate-200
            rounded-xl
            px-4 py-3
            outline-none
            text-slate-800
            transition-all duration-200
            placeholder:text-slate-400
            focus:bg-white
            focus:border-blue-600
            focus:ring-2
            focus:ring-blue-500/20
            disabled:opacity-50
            disabled:bg-slate-100
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
          `}
          {...props}
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 ml-1">{error}</p>
      )}
    </div>
  );
};

export default Input;
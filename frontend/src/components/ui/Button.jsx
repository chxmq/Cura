import React from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  loadingText,
  disabled = false,
  ...props
}) => {
  const { t } = useLanguage();
  const resolvedLoadingText = loadingText ?? t('common.loading');

  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0f766e] ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-[#0f766e] text-white hover:bg-[#115e59] shadow-[0_1px_2px_rgba(15,31,46,0.06),0_6px_16px_rgba(15,118,110,0.18)]',
    secondary:
      'bg-white text-[#0f1f2e] border border-[#d4cfbf] hover:border-[#0f766e] hover:text-[#0f766e]',
    ghost:
      'bg-transparent text-[#3e4c5b] hover:bg-[#f0eee6] hover:text-[#0f1f2e]',
    accent:
      'bg-[#e76f51] text-white hover:bg-[#d4583c] shadow-[0_1px_2px_rgba(15,31,46,0.06),0_6px_16px_rgba(231,111,81,0.2)]',
    danger:
      'bg-white text-[#b91c1c] border border-[#fecaca] hover:bg-[#fef2f2]',
    link:
      'bg-transparent text-[#0f766e] hover:text-[#115e59] underline-offset-4 hover:underline rounded'
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base'
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span>{resolvedLoadingText}</span>
        </>
      ) : children}
    </button>
  );
};

export default Button;

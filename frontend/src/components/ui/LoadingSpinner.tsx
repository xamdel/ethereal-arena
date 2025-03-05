'use client';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  fullscreen?: boolean;
  message?: string;
}

export function LoadingSpinner({ 
  size = 'medium', 
  fullscreen = false,
  message
}: LoadingSpinnerProps) {
  // Size-based styling
  const sizeClasses = {
    small: 'h-6 w-6 border-2',
    medium: 'h-12 w-12 border-4',
    large: 'h-20 w-20 border-4'
  };
  
  const spinnerClasses = `
    animate-spin 
    rounded-full 
    border-solid 
    border-blue-500 
    border-t-transparent 
    ${sizeClasses[size]}
  `;
  
  // Container with optional fullscreen support
  const containerClasses = `
    flex 
    flex-col 
    items-center 
    justify-center 
    ${fullscreen ? 'fixed inset-0 bg-black/50 z-50' : ''}
  `;
  
  return (
    <div className={containerClasses}>
      <div className={spinnerClasses}></div>
      {message && (
        <p className="mt-4 text-center text-white font-bold">{message}</p>
      )}
    </div>
  );
}
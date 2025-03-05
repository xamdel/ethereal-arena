'use client';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false
}: ConfirmDialogProps) {
  // Backdrop
  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      {/* Dialog box */}
      <div 
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-96 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        
        {/* Message */}
        <p className="text-gray-300 mb-6">{message}</p>
        
        {/* Buttons */}
        <div className="flex justify-end gap-4">
          <button
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          
          <button
            className={`
              px-4 py-2 rounded transition-colors
              ${isDestructive 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'}
            `}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
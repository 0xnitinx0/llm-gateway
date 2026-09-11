import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  textToCopy: string;
  className?: string;
  label?: string;
  size?: 'sm' | 'md';
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  className = '',
  label,
  size = 'sm',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSmall = size === 'sm';

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`inline-flex items-center gap-1.5 font-medium rounded transition-colors text-slate-500 hover:text-slate-800 hover:bg-slate-100 ${
        isSmall ? 'text-xs px-2 py-1' : 'text-sm px-2.5 py-1.5'
      } ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-emerald-600`} />
          <span className="text-emerald-600 font-medium">Copied</span>
        </>
      ) : (
        <>
          <Copy className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          <span>{label || 'Copy'}</span>
        </>
      )}
    </button>
  );
};

import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';

interface ApiKeyInputProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  disabled?: boolean;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  apiKey,
  setApiKey,
  disabled = false,
}) => {
  const [showKey, setShowKey] = useState(false);

  const handleUseDefault = () => {
    setApiKey('gateway-secret-key');
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor="gateway-api-key"
          className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
        >
          <KeyRound className="w-3.5 h-3.5 text-slate-500" />
          Gateway API Key
          <span className="font-mono text-[10px] font-normal text-slate-400">
            (sent as X-Gateway-API-Key)
          </span>
        </label>
        {apiKey !== 'gateway-secret-key' && (
          <button
            type="button"
            onClick={handleUseDefault}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium hover:underline focus:outline-none"
          >
            Use default key (gateway-secret-key)
          </button>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          id="gateway-api-key"
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={disabled}
          placeholder="gw_••••••••••••••••"
          className="w-full pl-3 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-md font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors disabled:bg-slate-50 disabled:text-slate-500 shadow-2xs"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          disabled={disabled}
          aria-label={showKey ? 'Hide API key' : 'Show API key'}
          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors focus:outline-none"
        >
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <ShieldAlert className="w-3 h-3 text-slate-400 shrink-0" />
        Single Gateway credential. Provider keys (Gemini, OpenAI, Anthropic) remain safely abstracted on the backend.
      </p>
    </div>
  );
};

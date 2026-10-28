import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';

export const ApiKeyInput: React.FC<{ apiKey: string; setApiKey: (key: string) => void; disabled?: boolean }> = ({ apiKey, setApiKey, disabled = false }) => {
  const [show, setShow] = useState(false);
  return <div className="space-y-1.5"><label htmlFor="gateway-api-key" className="text-xs font-semibold text-earth-700 flex flex-wrap gap-1.5"><KeyRound className="w-3.5 h-3.5"/>Gateway API Key <span className="font-mono font-normal text-earth-500">(X-Gateway-API-Key)</span></label><div className="relative"><input id="gateway-api-key" type={show ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} disabled={disabled} placeholder="Enter a gateway key" className="w-full px-3 py-2 pr-10 border rounded-md font-mono text-sm" autoComplete="off"/><button type="button" aria-label={show ? 'Hide API key' : 'Show API key'} onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-earth-500">{show ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button></div><p className="text-[11px] text-earth-500 flex gap-1"><ShieldAlert className="w-3 h-3"/>Create a key from the API Keys page or enter the seeded local demo key manually.</p></div>;
};

import React, { useEffect, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';

interface PromptEditorProps {
  prompt: string;
  setPrompt: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

const DEMO_PROMPTS = [
  'Explain quantum computing in simple terms for a first-year computer science student.',
  'What are the key architectural advantages of an LLM API Gateway over direct provider calls?',
  'Write a Python function to compute the cosine similarity between two dense embedding vectors.',
];

export const PromptEditor: React.FC<PromptEditorProps> = ({
  prompt,
  setPrompt,
  onSubmit,
  isLoading,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && prompt.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  // Focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor="gateway-prompt"
          className="text-xs font-semibold text-earth-700 flex items-center gap-1.5"
        >
          Prompt
        </label>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-earth-500 font-mono">
            {prompt.length} characters
          </span>
          <span className="hidden sm:inline-block text-[10px] text-earth-500 bg-earth-100 px-1.5 py-0.5 rounded border border-earth-200">
            Ctrl + Enter
          </span>
        </div>
      </div>

      <div className="relative">
        <textarea
          id="gateway-prompt"
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder="Ask the Gateway anything..."
          rows={5}
          className="w-full p-3.5 text-sm bg-surface border border-earth-300 rounded-md text-earth-800 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-600 transition-colors disabled:bg-earth-50 disabled:text-earth-500 resize-y shadow-2xs font-sans leading-relaxed"
          spellCheck="false"
        />
      </div>

      {/* Suggested demo prompts pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] text-earth-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-ochre-500" />
          Quick prompts:
        </span>
        {DEMO_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading || disabled}
            onClick={() => setPrompt(p)}
            className="text-[11px] text-earth-600 hover:text-accent-600 bg-earth-100 hover:bg-accent-50/70 border border-earth-200/80 rounded-full px-2.5 py-0.5 transition-colors text-left truncate max-w-xs focus:outline-none"
            title={p}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-earth-100">
        <div className="text-[11px] text-earth-500">
          Gateway Router: <span className="font-mono font-medium text-earth-700">Intelligent Auto-Routing</span> (Groq / Cerebras / Gemini)
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onSubmit}
          isLoading={isLoading}
          disabled={disabled || !prompt.trim()}
          rightIcon={!isLoading ? <Send className="w-4 h-4" /> : undefined}
        >
          {isLoading ? 'Generating response...' : 'Send Request'}
        </Button>
      </div>
    </div>
  );
};

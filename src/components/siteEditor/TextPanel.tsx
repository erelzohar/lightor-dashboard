import React from 'react';
import { useTranslation } from 'react-i18next';
import { aiEditable, fieldInfo } from '../../utils/editorFields';
import AiBox from './AiBox';
import { fieldLabel } from './labels';

interface TextPanelProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onApplyAi: (values: Record<string, string>) => void;
}

/** LT-249: one text — typed by hand (the preview follows), or rewritten by the AI. */
const TextPanel: React.FC<TextPanelProps> = ({ path, value, onChange, onApplyAi }) => {
  const { t } = useTranslation();
  const info = fieldInfo(path);
  const label = fieldLabel(t, path);
  const common = {
    id: 'site-editor-text',
    value,
    maxLength: info.maxLength,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    className: 'w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30',
  };
  return (
    <div className="flex flex-col gap-4" data-testid="text-panel">
      <div>
        <label htmlFor="site-editor-text" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{label}</label>
        {info.multiline ? <textarea {...common} rows={5} /> : <input {...common} type="text" />}
        {info.maxLength && (
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500 text-end" aria-live="polite">
            {t('siteEditor.text.count', { count: value.length, max: info.maxLength })}
          </p>
        )}
      </div>
      {aiEditable(path) && (
        <AiBox fields={[{ path, value, label, maxLength: info.maxLength }]} onApply={onApplyAi} />
      )}
    </div>
  );
};

export default TextPanel;

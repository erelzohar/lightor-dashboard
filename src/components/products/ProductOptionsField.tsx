import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { ProductColor } from '../../services/productsApi';
import ColorPicker from '../ui/ColorPicker';

const MAX_COLORS = 12;
const MAX_SIZES = 16;
const MAX_OPTION = 24;

/**
 * LT-588 (Erel's card with colours and sizes): what a product comes in. A
 * colour is a name (what the visitor reads, what the owner gets with the
 * inquiry) and a swatch; a size is a short word. The site offers them to pick.
 */
const ProductOptionsField: React.FC<{
  colors: ProductColor[];
  sizes: string[];
  onColors: (colors: ProductColor[]) => void;
  onSizes: (sizes: string[]) => void;
  labelClass: string;
  fieldClass: string;
}> = ({ colors, sizes, onColors, onSizes, labelClass, fieldClass }) => {
  const { t } = useTranslation();
  const id = useId();
  const [hex, setHex] = useState('#1e293b');
  const [colorName, setColorName] = useState('');
  const [size, setSize] = useState('');

  const addColor = () => {
    const name = colorName.trim();
    if (!name || colors.length >= MAX_COLORS || colors.some((c) => c.name === name)) return;
    onColors([...colors, { name, hex }]);
    setColorName('');
  };
  const addSize = () => {
    const text = size.trim();
    if (!text || sizes.length >= MAX_SIZES || sizes.includes(text)) return;
    onSizes([...sizes, text]);
    setSize('');
  };
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-sm text-gray-700 dark:text-slate-200';

  return (
    <div className="space-y-4" data-testid="product-options">
      <div>
        <p className={labelClass}>{t('products.colors')}</p>
        {colors.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {colors.map((c, i) => (
              <li key={c.name} className={chip}>
                <span className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                {c.name}
                <button type="button" aria-label={t('products.removeOption', { name: c.name })} onClick={() => onColors(colors.filter((_, k) => k !== i))}><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        {colors.length < MAX_COLORS && (
          <div className="flex items-center gap-2">
            {/* LT-598 (Erel): the same colour picker as the editor's main colour. */}
            <ColorPicker compact color={hex} onChange={setHex} label={t('products.colorSwatch')} />
            <input
              id={`${id}-color`}
              className={fieldClass}
              maxLength={MAX_OPTION}
              value={colorName}
              placeholder={t('products.colorPlaceholder')}
              aria-label={t('products.colorName')}
              onChange={(e) => setColorName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }}
            />
            <button type="button" onClick={addColor} disabled={!colorName.trim()} aria-label={t('products.addColor')} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 text-primary disabled:opacity-40">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-size`}>{t('products.sizes')}</label>
        {sizes.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {sizes.map((s, i) => (
              <li key={s} className={chip}>
                {s}
                <button type="button" aria-label={t('products.removeOption', { name: s })} onClick={() => onSizes(sizes.filter((_, k) => k !== i))}><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        {sizes.length < MAX_SIZES && (
          <input
            id={`${id}-size`}
            className={fieldClass}
            maxLength={MAX_OPTION}
            value={size}
            placeholder={t('products.sizePlaceholder')}
            onChange={(e) => setSize(e.target.value)}
            onBlur={addSize}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
          />
        )}
      </div>
    </div>
  );
};

export default ProductOptionsField;

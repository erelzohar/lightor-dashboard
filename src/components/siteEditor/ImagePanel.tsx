import React, { useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../../services/imagesApi';
import { resolveImage } from '../../utils/images';
import { fieldLabel } from './labels';
import AddPhotoButton from './AddPhotoButton';

interface ImagePanelProps {
  path: string;
  value: string;
  /** The pictures already on the site, to reuse one. */
  siteImages: string[];
  onChange: (imageName: string) => void;
  /** A fresh upload this session (for clean-up if it is never kept). */
  onUploaded: (imageName: string) => void;
  /** Gallery photos can leave the gallery; the hero image and the logo cannot. */
  onRemove?: () => void;
  /** LT-320: on a gallery photo, another photo can join the gallery. */
  onAddPhoto?: (imageName: string) => void;
}

/** LT-249: one picture — upload a new one, reuse one from the site, or take a gallery photo out. */
const ImagePanel: React.FC<ImagePanelProps> = ({ path, value, siteImages, onChange, onUploaded, onRemove, onAddPhoto }) => {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // The logo is contained in a square on the server; every other picture keeps its shape.
  const shape = path === 'logoImageName' ? undefined : 'photo';

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const { imageName } = await uploadImage(file, shape);
      onUploaded(imageName);
      onChange(imageName);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const choices = siteImages.filter((name) => name && name !== value);

  return (
    <div className="flex flex-col gap-4" data-testid="image-panel">
      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{fieldLabel(t, path)}</p>
      {value ? (
        <img src={resolveImage(value)} alt="" className="w-full max-h-48 object-contain rounded-xl bg-gray-100 dark:bg-slate-800" />
      ) : (
        <div className="w-full h-32 rounded-xl bg-gray-100 dark:bg-slate-800" />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm font-medium disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {busy ? t('siteEditor.image.uploading') : t('siteEditor.image.replace')}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            {t('siteEditor.image.removeFromGallery')}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" data-testid="image-input" onChange={(e) => void upload(e.target.files?.[0])} />
      {onAddPhoto && <AddPhotoButton onAdded={onAddPhoto} />}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t('siteEditor.image.uploadFailed')}</p>}
      {choices.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{t('siteEditor.image.choose')}</p>
          <div className="grid grid-cols-4 gap-2">
            {choices.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onChange(name)}
                className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary"
                aria-label={t('siteEditor.image.use')}
              >
                <img src={resolveImage(name)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePanel;

import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../../services/imagesApi';

/**
 * LT-320: a new photo for the gallery, uploaded from the editor. Until now the
 * editor could only replace or remove gallery photos, so a gallery emptied
 * here had no way back.
 */
const AddPhotoButton: React.FC<{ onAdded: (imageName: string) => void }> = ({ onAdded }) => {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const { imageName } = await uploadImage(file, 'photo');
      onAdded(imageName);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 text-sm font-medium text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-4 h-4" aria-hidden="true" />}
        {busy ? t('siteEditor.image.uploading') : t('siteEditor.image.addToGallery')}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" data-testid="add-photo-input" onChange={(e) => void upload(e.target.files?.[0])} />
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t('siteEditor.image.uploadFailed')}</p>}
    </div>
  );
};

export default AddPhotoButton;

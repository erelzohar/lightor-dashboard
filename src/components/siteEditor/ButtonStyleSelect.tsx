import { useTranslation } from 'react-i18next';
import Select from '../ui/Select';
import { BUTTON_STYLES, optionLabel } from '../../utils/editorOptions';
import { vocabLang } from './labels';
import { ButtonSample } from './ThemeSamples';

interface ButtonStyleSelectProps {
  id: string;
  label: string;
  /** The site's choice (`design.buttonStyle`); '' = as its style draws it. */
  value: string;
  /** The site's main colour, for the samples. */
  color: string;
  onChange: (value: string) => void;
}

/**
 * The main button's design with a sample beside each name (LT-595): the same
 * list in the design tab and in the button's own panel (LT-693), both setting
 * the one `design.buttonStyle`.
 */
const ButtonStyleSelect = ({ id, label, value, color, onChange }: ButtonStyleSelectProps) => {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  return (
    <Select
      id={id}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '', label: t('siteEditor.theme.byStyle') },
        ...Object.keys(BUTTON_STYLES).map((v) => {
          const name = optionLabel(BUTTON_STYLES, v, lang);
          return { value: v, text: name, selected: name, label: <span className="flex min-w-0 items-center gap-2.5"><ButtonSample style={v} color={color} /><span className="truncate">{name}</span></span> };
        }),
      ]}
    />
  );
};

export default ButtonStyleSelect;

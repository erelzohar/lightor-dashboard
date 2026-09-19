import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, ArrowDown, ArrowUp, Check, ChevronDown, ClipboardList, Eye, MapPin, Plus, Trash2, X,
} from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import FieldTooltip from './FieldTooltip';
import type { AppointmentType, BookingField, BookingFieldType } from '../../types';
import {
  BOOKING_FIELD_TYPES,
  MAX_BOOKING_FIELDS,
  MAX_CHOICE_OPTIONS,
  MAX_LABEL_LENGTH,
  MAX_OPTION_LENGTH,
  MIN_CHOICE_OPTIONS,
  bookingFieldProblems,
  fieldsForService,
  newBookingField,
} from '../../utils/bookingFields';

interface BookingFieldsEditorProps {
  value: BookingField[];
  onChange: (fields: BookingField[]) => void;
  /** The business's services, for the applies-to picker and the preview. */
  services: AppointmentType[];
}

const ICON_BTN =
  'w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 ' +
  'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white ' +
  'transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';

const CHIP = 'px-3 py-1 rounded-full text-xs font-medium border transition-colors';
const CHIP_ON = 'bg-primary text-white border-primary';
const CHIP_OFF =
  'bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 ' +
  'hover:border-primary/50';

const PREVIEW_BOX =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface ' +
  'px-3 py-2 text-sm text-gray-400 dark:text-gray-500';

/**
 * The booking-questions editor (LT-178): the owner's own questions, on five
 * input shapes, that the public booking form asks under name and phone.
 *
 * Emits the draft catalog on every keystroke; Settings owns it, marks the
 * form dirty and sends it with the rest of the config. A question added here
 * carries no `key` — the server assigns one on save and this editor sends it
 * back unchanged from then on.
 */
const BookingFieldsEditor: React.FC<BookingFieldsEditorProps> = ({ value, onChange, services }) => {
  const { t } = useTranslation();
  const [previewService, setPreviewService] = useState('*');

  const fields = value ?? [];
  const problems = bookingFieldProblems(fields);
  const atCap = fields.length >= MAX_BOOKING_FIELDS;
  const addressIndex = fields.findIndex((f) => f.type === 'address');
  const serviceIds = services.map((s) => s._id);

  const typeLabel = (type: BookingFieldType) => t(`settings.bookingFields.types.${type}`);

  const update = (index: number, patch: Partial<BookingField>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const add = () => {
    if (atCap) return;
    onChange([...fields, newBookingField()]);
  };

  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const changeType = (index: number, type: BookingFieldType) => {
    const field = fields[index];
    const patch: BookingField = { ...field, type };
    if (type === 'choice') {
      if (!patch.options?.length) patch.options = Array.from({ length: MIN_CHOICE_OPTIONS }, () => '');
    } else {
      delete patch.options;
    }
    onChange(fields.map((f, i) => (i === index ? patch : f)));
  };

  const setOption = (index: number, optionIndex: number, text: string) => {
    const options = [...(fields[index].options ?? [])];
    options[optionIndex] = text;
    update(index, { options });
  };

  const addOption = (index: number) => {
    const options = fields[index].options ?? [];
    if (options.length >= MAX_CHOICE_OPTIONS) return;
    update(index, { options: [...options, ''] });
  };

  const removeOption = (index: number, optionIndex: number) => {
    const options = fields[index].options ?? [];
    if (options.length <= MIN_CHOICE_OPTIONS) return;
    update(index, { options: options.filter((_, i) => i !== optionIndex) });
  };

  // [] means every service. Toggling a chip narrows from "all" to "all but
  // this one"; narrowing to nothing, or back to everything, is "all" again.
  const toggleService = (index: number, id: string) => {
    const current = fields[index].services.length ? fields[index].services : serviceIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const everything = serviceIds.every((s) => next.includes(s));
    update(index, { services: next.length === 0 || everything ? [] : next });
  };

  const appliesTo = (field: BookingField, id: string) =>
    field.services.length === 0 || field.services.includes(id);

  const previewFields = previewService === '*' ? fields : fieldsForService(fields, previewService);

  return (
    <div className="mt-6 p-6 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-50/30 dark:bg-gray-800/20 space-y-4 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="w-5 h-5 text-primary shrink-0" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
            {t('settings.bookingFields.title')}
          </h3>
          <FieldTooltip
            title={t('settings.bookingFields.title')}
            description={t('settings.bookingFields.description')}
          />
          <span className="text-xs text-gray-400 tabular-nums" data-testid="booking-fields-count">
            {fields.length}/{MAX_BOOKING_FIELDS}
          </span>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={atCap}
          title={atCap ? t('settings.bookingFields.limitReached') : undefined}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          {t('settings.bookingFields.addQuestion')}
        </button>
      </div>

      {/* The two things an owner must know before adding a question. */}
      <div className="space-y-1.5 text-[0.8125rem] text-gray-500 dark:text-gray-400">
        <p className="flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <span>{t('settings.bookingFields.lengthNote')}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
          <span>{t('settings.bookingFields.rawNote')}</span>
        </p>
      </div>

      {/* Questions */}
      {fields.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">{t('settings.bookingFields.empty')}</p>
      ) : (
        <ul className="space-y-3" data-testid="booking-fields-list">
          {fields.map((field, index) => {
            const fieldProblems = problems.get(index) ?? [];
            const isChoice = field.type === 'choice';
            const options = field.options ?? [];

            return (
              <li
                key={field.key ?? `new-${index}`}
                className="rounded-xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-dark-surface p-4 space-y-3"
                data-testid="booking-field"
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-8">
                    {index + 1}
                  </span>

                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      label={t('settings.bookingFields.label')}
                      value={field.label}
                      maxLength={MAX_LABEL_LENGTH}
                      placeholder={t('settings.bookingFields.labelPlaceholder')}
                      error={fieldProblems.includes('label') ? t('settings.bookingFields.labelRequired') : undefined}
                      onChange={(e) => update(index, { label: e.target.value })}
                      aria-label={t('settings.bookingFields.label')}
                    />
                    <Select
                      label={t('settings.bookingFields.type')}
                      value={field.type}
                      onChange={(e) => changeType(index, e.target.value as BookingFieldType)}
                      options={BOOKING_FIELD_TYPES.map((type) => ({
                        value: type,
                        label: typeLabel(type),
                        // One address per business: the option stays visible
                        // but cannot be picked while another question is it.
                        disabled: type === 'address' && addressIndex !== -1 && addressIndex !== index,
                      }))}
                      error={fieldProblems.includes('address') ? t('settings.bookingFields.oneAddress') : undefined}
                      aria-label={t('settings.bookingFields.type')}
                    />
                  </div>

                  <div className="flex flex-col gap-1 shrink-0 mt-7">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className={ICON_BTN}
                      title={t('settings.bookingFields.moveUp')}
                      aria-label={t('settings.bookingFields.moveUp')}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === fields.length - 1}
                      className={ICON_BTN}
                      title={t('settings.bookingFields.moveDown')}
                      aria-label={t('settings.bookingFields.moveDown')}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className={`${ICON_BTN} hover:!bg-rose-50 dark:hover:!bg-rose-900/20 hover:!text-rose-600`}
                      title={t('settings.bookingFields.delete')}
                      aria-label={t('settings.bookingFields.delete')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {isChoice && (
                  <div className="ps-9 space-y-2">
                    <p className="text-[0.875rem] font-medium text-gray-700 dark:text-gray-300">
                      {t('settings.bookingFields.options')}
                      <span className="ms-2 text-xs font-normal text-gray-400 tabular-nums">
                        {options.length}/{MAX_CHOICE_OPTIONS}
                      </span>
                    </p>
                    <ul className="space-y-2">
                      {options.map((option, optionIndex) => (
                        <li key={optionIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option}
                            maxLength={MAX_OPTION_LENGTH}
                            placeholder={t('settings.bookingFields.optionPlaceholder', { n: optionIndex + 1 })}
                            aria-label={t('settings.bookingFields.optionPlaceholder', { n: optionIndex + 1 })}
                            onChange={(e) => setOption(index, optionIndex, e.target.value)}
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-[0.1875rem] focus:ring-primary/20 focus:border-primary transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index, optionIndex)}
                            disabled={options.length <= MIN_CHOICE_OPTIONS}
                            className={ICON_BTN}
                            title={t('settings.bookingFields.removeOption')}
                            aria-label={t('settings.bookingFields.removeOption')}
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => addOption(index)}
                      disabled={options.length >= MAX_CHOICE_OPTIONS}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                      {t('settings.bookingFields.addOption')}
                    </button>
                    {fieldProblems.includes('options') && (
                      <p className="text-sm text-red-500">{t('settings.bookingFields.optionsInvalid')}</p>
                    )}
                  </div>
                )}

                <div className="ps-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={field.required}
                      onChange={(e) => update(index, { required: e.target.checked })}
                      aria-label={t('settings.bookingFields.required')}
                    />
                    <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.125rem] after:start-[0.125rem] after:bg-white dark:after:bg-gray-100 after:border-gray-300 dark:after:border-dark-gray/50 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                    <span className="ms-2 text-sm text-gray-700 dark:text-gray-300">
                      {t('settings.bookingFields.required')}
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400 me-1">
                      {t('settings.bookingFields.appliesTo')}
                    </span>
                    <button
                      type="button"
                      onClick={() => update(index, { services: [] })}
                      aria-pressed={field.services.length === 0}
                      className={`${CHIP} ${field.services.length === 0 ? CHIP_ON : CHIP_OFF}`}
                    >
                      {t('settings.bookingFields.allServices')}
                    </button>
                    {services.map((service) => (
                      <button
                        key={service._id}
                        type="button"
                        onClick={() => toggleService(index, service._id)}
                        aria-pressed={appliesTo(field, service._id)}
                        className={`${CHIP} ${appliesTo(field, service._id) ? CHIP_ON : CHIP_OFF} max-w-[12rem] truncate`}
                        title={service.name}
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Live preview of the customer's form */}
      {fields.length > 0 && (
        <div
          className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3"
          data-testid="booking-fields-preview"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Eye size={13} />
              {t('settings.bookingFields.preview')}
            </p>
            {services.length > 0 && (
              <select
                value={previewService}
                onChange={(e) => setPreviewService(e.target.value)}
                aria-label={t('settings.bookingFields.appliesTo')}
                className="text-xs rounded-lg border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="*">{t('settings.bookingFields.allServices')}</option>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>{service.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="max-w-sm space-y-3" aria-hidden="true">
            <div className={PREVIEW_BOX}>{t('customers.add.name')}</div>
            <div className={PREVIEW_BOX}>{t('customers.add.phone')}</div>

            {previewFields.map((field, index) => {
              const label = field.label.trim();
              const labelNode = (
                <span className={label ? 'text-gray-700 dark:text-gray-200' : 'italic text-gray-400'}>
                  {label || t('settings.bookingFields.labelPlaceholder')}
                  {field.required && <span className="text-red-500 ms-0.5">*</span>}
                </span>
              );

              if (field.type === 'confirm') {
                return (
                  <label key={index} className="flex items-start gap-2 text-sm">
                    <span className="w-4 h-4 mt-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface shrink-0 flex items-center justify-center">
                      <Check size={11} className="text-transparent" />
                    </span>
                    {labelNode}
                  </label>
                );
              }

              return (
                <div key={index} className="space-y-1 text-sm">
                  <span className="block">{labelNode}</span>
                  {field.type === 'note' ? (
                    <div className={`${PREVIEW_BOX} h-16`} />
                  ) : field.type === 'choice' ? (
                    <div className={`${PREVIEW_BOX} flex items-center justify-between gap-2`}>
                      <span className="truncate">{(field.options ?? []).find((o) => o.trim()) || '…'}</span>
                      <ChevronDown size={14} className="shrink-0" />
                    </div>
                  ) : (
                    <div className={`${PREVIEW_BOX} flex items-center gap-2`}>
                      {field.type === 'address' && <MapPin size={14} className="shrink-0" />}
                      <span>&nbsp;</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingFieldsEditor;

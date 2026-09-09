import React from 'react';
import { Calendar, Clock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Session, activeParticipants, sessionDisplayStatus } from '../../utils/sessions';
import { initialsOf } from './SessionParticipants';

interface SessionCardProps {
  session: Session;
  dateLabel: string;
  onOpen: (session: Session) => void;
}

const AVATAR_TINTS = [
  'bg-blue-200 text-blue-800',
  'bg-emerald-200 text-emerald-800',
  'bg-purple-200 text-purple-800',
  'bg-amber-200 text-amber-800',
  'bg-pink-200 text-pink-800',
  'bg-teal-200 text-teal-800',
] as const;

const hashStr = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const STATUS_TAG: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  ongoing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const FACES_SHOWN = 4;

/**
 * One card for a whole session (LT-152) — the list's answer to a class of
 * twelve, which used to render as twelve identical cards each with its own
 * call button. Opens the roster rather than a single booking.
 */
const SessionCard: React.FC<SessionCardProps> = ({ session, dateLabel, onOpen }) => {
  const { t } = useTranslation();

  const going = activeParticipants(session);
  const status = sessionDisplayStatus(session);
  const faces = going.slice(0, FACES_SHOWN);
  const overflow = going.length - faces.length;
  const minutes = Math.round(session.durationMS / 60000);
  const perHead = Number(session.type?.price);
  const revenue = Number.isFinite(perHead) ? perHead * going.length : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(session)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(session);
        }
      }}
      className="group cursor-pointer bg-light-surface p-4 rounded-xl border border-light-gray/10 shadow-sm
        hover:shadow-md hover:border-primary/20 transition-all duration-200 transform hover:-translate-y-1
        dark:shadow-none dark:hover:shadow-none dark:hover:bg-dark-surface/50 text-start
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="min-w-0">
          <h4 className="font-medium text-lg mb-1 truncate group-hover:text-primary transition-colors">
            {session.type?.name}
          </h4>
          <div className="flex items-center text-light-gray text-sm gap-2">
            <Calendar size={14} className="shrink-0" />
            <span>{dateLabel}</span>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_TAG[status] ?? ''}`}>
          {t(`appointments.${status}`)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex -space-s-2">
            {faces.map((participant, index) => (
              <span
                key={participant._id}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold
                  ring-2 ring-light-surface dark:ring-dark-surface
                  ${AVATAR_TINTS[hashStr(participant.phone || participant.name || String(index)) % AVATAR_TINTS.length]}`}
              >
                {initialsOf(participant.name)}
              </span>
            ))}
            {overflow > 0 && (
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold
                bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-100
                ring-2 ring-light-surface dark:ring-dark-surface">
                +{overflow}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium truncate">
            <Users size={14} className="shrink-0" />
            {t('appointments.session.participants', { count: going.length })}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-light-gray/10">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-light-gray gap-1">
            <Clock size={14} className="shrink-0" />
            <span>{minutes} {t('appointments.minutes')}</span>
          </div>
          {revenue !== null && (
            <span className="font-medium text-primary tabular-nums">
              {t('appointments.currencySymbol')}{revenue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionCard;

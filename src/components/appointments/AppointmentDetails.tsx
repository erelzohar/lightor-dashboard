import React from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, User, Phone, Check, X as XIcon, DollarSign } from 'lucide-react';
import { Appointment } from '../../types';
import Button from '../ui/Button';
import { formatDateTime, formatDuration } from '../../utils/dateUtils';
// import { updateAppointmentStatus } from '../../services/appointmentsApi';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { updateAppointmentStatus } from '../../store/slices/appointmentsSlice'
import { getDisplayStatus } from '../../utils/appointmentUtils';
interface AppointmentDetailsProps {
  appointment: Appointment | null;
  onClose: () => void;
  onUpdate: () => void;
}

const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({
  appointment,
  onClose,
  onUpdate,
}) => {
  const [loading, setLoading] = React.useState(false);
  const { language, direction } = useTheme();
  const dispatch = useAppDispatch();

  if (!appointment) return null;

  const handleStatusChange = async (status: 'scheduled' | 'completed' | 'cancelled') => {
    if (!appointment) return;

    if (status === 'cancelled') {
      const isConfirmed = window.confirm(
        language === 'he'
          ? 'האם אתה בטוח שברצונך לבטל תור זה?'
          : 'Are you sure you want to cancel this appointment?'
      );
      if (!isConfirmed) return;
    }

    setLoading(true);
    try {
      dispatch(updateAppointmentStatus({ id: appointment._id, status }))
      // console.log(res);

      toast.success(language === 'he'
        ? ' התור עודכן בהצלחה'
        : 'Appointment updated successfully'
      );

      onUpdate();
      onClose();
    } catch (error) {
      toast.error(language === 'he'
        ? 'אירעה שגיאה בעדכון  התור'
        : 'Failed to update appointment'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled':
        return language === 'he' ? 'ממתין' : 'Scheduled';
      case 'completed':
        return language === 'he' ? 'הושלם' : 'Completed';
      case 'cancelled':
        return language === 'he' ? 'בוטל' : 'Cancelled';
      case 'ongoing':
        return language === 'he' ? 'בתהליך' : 'Ongoing';
      default:
        return status;
    }
  };

  const formatPhoneNumber = (phone: string) => {
    return phone.startsWith('0') ? phone : `0${phone.slice(3)}`;
  };

  const getWhatsAppLink = (phone: string) => {
    const formattedPhone = phone.startsWith('+') ? phone.slice(1) : `972${phone.slice(1)}`;
    return `https://wa.me/${formattedPhone}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 text-center">
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />

        <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`inline-block w-full max-w-lg p-6 my-8 align-middle bg-light-surface dark:bg-dark-surface
            rounded-2xl shadow-xl relative border border-light-gray/10
            ${direction === 'rtl' ? 'rtl text-right' : 'ltr text-left'}`}
        >
          <div className={`absolute top-4 ${direction === 'rtl' ? 'left-4' : 'right-4'}`}>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-light-gray/10 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-2">
            <div className="flex items-center space-x-3">
              <div
                className={`px-3 py-1.5 rounded-lg text-sm font-medium
                  ${(() => {
                    const displayStatus = getDisplayStatus(appointment);
                    if (displayStatus === 'scheduled') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
                    if (displayStatus === 'completed') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
                    if (displayStatus === 'ongoing') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
                    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
                  })()}
                `}
              >
                {getStatusText(getDisplayStatus(appointment))}
              </div>
            </div>

            <div className="bg-light-gray/5 dark:bg-dark-bg rounded-xl p-4 mt-6 mb-4">
              <h3 className="font-semibold text-xl mb-2">{appointment.type.name}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center text-light-text dark:text-dark-text">
                  <Calendar size={18} className={`text-primary ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                  <span>{formatDateTime(parseInt(appointment.timestamp), language)}</span>
                </div>

                <div className="flex items-center text-light-text dark:text-dark-text">
                  <Clock size={18} className={`text-primary ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                  <span>{formatDuration(appointment.type.durationMS, language)}</span>
                </div>
              </div>
            </div>

            <div className="bg-light-gray/5 dark:bg-dark-bg rounded-xl p-4 mb-4">
              <h4 className="font-medium text-lg mb-4">
                {language === 'he' ? 'פרטי לקוח' : 'Customer Details'}
              </h4>

              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center text-light-text dark:text-dark-text">
                  <User size={18} className={`text-primary ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                  <span>{appointment.name}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <a
                      href={`tel:${formatPhoneNumber(appointment.phone)}`}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#088F8F] text-white hover:bg-[#088F8F]/80 transition-colors"
                    >
                      <Phone size={18} />
                      <span>{formatPhoneNumber(appointment.phone)}</span>
                    </a>

                    <a
                      href={getWhatsAppLink(appointment.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-light-gray/5 dark:bg-dark-bg rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-light-text dark:text-dark-text">
                  <DollarSign size={18} className={`text-primary ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                  <span>{language === 'he' ? 'מחיר' : 'Price'}</span>
                </div>
                <span className="text-xl font-semibold text-primary">
                  {language === 'he' ? '₪' : '$'}{appointment.type.price}
                </span>
              </div>
            </div>

            {appointment.status === 'scheduled' && (
              <div className="flex gap-3">
                <Button
                  variant="success"
                  leftIcon={<Check size={18} />}
                  isLoading={loading}
                  onClick={() => handleStatusChange('completed')}
                  className="flex-1"
                >
                  {language === 'he' ? 'סמן כהושלם' : 'Mark Completed'}
                </Button>

                <Button
                  variant="danger"
                  leftIcon={<XIcon size={18} />}
                  isLoading={loading}
                  onClick={() => handleStatusChange('cancelled')}
                  className="flex-1"
                >
                  {language === 'he' ? 'ביטול תור' : 'Cancel'}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AppointmentDetails;
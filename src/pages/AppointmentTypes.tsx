import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Timer, DollarSign, Tag } from 'lucide-react';
import { AppointmentType } from '../types';
//import { getAppointmentTypes, createAppointmentType, updateAppointmentType, deleteAppointmentType } from '../services/appointmentsApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { formatDuration } from '../utils/dateUtils';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppSelector } from '../hooks/useAppSelector';
import { useDispatch } from 'react-redux';
import { createAppointmentType, deleteAppointmentType, fetchAppointmentTypes, updateAppointmentType } from '../store/slices/appointmentsSlice';
import { useAppDispatch } from '../hooks/useAppDispatch';

const AppointmentTypes: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentType, setCurrentType] = useState<AppointmentType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    durationMS: ''
  });
  const { language } = useTheme();
  const { auth } = useAuth();
  document.title = language === "he" ? "סוגי שירותים" : "Appointment Types";
  const appointmentTypes = useAppSelector(state => state.appointments.appointmentTypes);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (appointmentTypes.length === 0 && auth.user) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id }));
    }
    else setIsLoading(false);
  }, [appointmentTypes]);

  const handleAddNew = () => {
    setCurrentType(null);
    setFormData({
      name: '',
      price: '',
      durationMS: '1800000' // Default 30 minutes
    });
    setIsEditing(true);
  };

  const handleEdit = (type: AppointmentType) => {
    setCurrentType(type);
    setFormData({
      name: type.name,
      price: type.price,
      durationMS: type.durationMS
    });
    setIsEditing(true);
  };

  const handleDelete = async (type: AppointmentType) => {
    if (!confirm(language === 'he'
      ? `האם אתה בטוח שברצונך למחוק את "${type.name}"?`
      : `Are you sure you want to delete "${type.name}"?`)) {
      return;
    }

    try {
      await dispatch(deleteAppointmentType(type._id));
      toast.success(
        language === 'he'
          ? 'סוג הפגישה נמחק בהצלחה'
          : 'Appointment type deleted successfully'
      );
    } catch (error) {
      toast.error(
        language === 'he'
          ? 'אירעה שגיאה במחיקת סוג הפגישה'
          : 'Failed to delete appointment type'
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Convert duration from minutes to milliseconds
    if (name === 'durationMinutes') {
      const minutes = parseInt(value) || 0;
      setFormData(prev => ({
        ...prev,
        durationMS: (minutes * 60 * 1000).toString()
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (currentType) {
        await dispatch(updateAppointmentType({ id: currentType._id, data: { ...formData } }))
        toast.success(
          language === 'he'
            ? 'סוג הפגישה עודכן בהצלחה'
            : 'Appointment type updated successfully'
        );
      } else {
        await dispatch(createAppointmentType({ ...formData, webConfig_id: auth.user.webConfig_id }));
        toast.success(
          language === 'he'
            ? 'סוג הפגישה נוסף בהצלחה'
            : 'Appointment type added successfully'
        );
      }

      setIsEditing(false);
    } catch (error) {
      toast.error(
        language === 'he'
          ? 'אירעה שגיאה בשמירת סוג הפגישה'
          : 'Failed to save appointment type'
      );
    }
  };

  const getDurationMinutes = () => {
    const ms = parseInt(formData.durationMS);
    return Math.floor(ms / 60000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Tag className="text-primary w-5 h-5" />
          <h1 className="font-semibold text-xl text-gray-800 dark:text-white">
            {language === 'he' ? 'ניהול סוגי שירותים' : 'Service Types'}
          </h1>
        </div>
        <p className="text-light-text dark:text-gray-400 text-sm mt-1 mb-2">
          {language === 'he'
            ? 'ניהול השירותים השונים שהעסק שלך מציע'
            : 'Manage the different services your business offers'
          }
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Edit Form */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-1"
          >
            <Card>
              <h3 className="font-semibold text-lg mb-4">
                {currentType
                  ? (language === 'he' ? 'עריכת שירות' : 'Edit Service')
                  : (language === 'he' ? 'שירות חדש' : 'New Service')
                }
              </h3>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <Input
                    label={language === 'he' ? 'שם השירות' : 'Service Name'}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    leftIcon={<Tag size={18} />}
                    required
                    autoFocus
                  />

                  <Input
                    label={language === 'he' ? 'מחיר (₪)' : 'Price ($)'}
                    name="price"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.price}
                    onChange={handleChange}
                    leftIcon={<DollarSign size={18} />}
                    required
                  />

                  <Input
                    label={language === 'he' ? 'משך (דקות)' : 'Duration (minutes)'}
                    name="durationMinutes"
                    type="number"
                    min="5"
                    step="5"
                    value={getDurationMinutes()}
                    onChange={handleChange}
                    leftIcon={<Timer size={18} />}
                    required
                  />
                </div>

                <div className="flex justify-around space-x-3 mt-6">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setIsEditing(false)}
                  >
                    {language === 'he' ? 'ביטול' : 'Cancel'}
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                  >
                    {language === 'he' ? 'שמור' : 'Save'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
        {/* Appointment Types List */}
        <div className="md:col-span-2">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">
                {language === 'he' ? 'שירותים' : 'Services'}
              </h3>

              <Button
                onClick={handleAddNew}
                leftIcon={<Plus size={16} />}
                variant="primary"
                size="sm"
              >
                {language === 'he' ? 'הוסף חדש' : 'Add New'}
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-light-gray rounded-md animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {appointmentTypes.length > 0 ? (
                  appointmentTypes.map((type, i) => (
                    <motion.div
                      key={type._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 border border-light-gray rounded-md shadow-md"
                    >
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-medium text-lg">{type.name}</h4>

                          <div className="flex items-center mt-2">
                            <div className="flex items-center mr-4">
                              <DollarSign size={16} className="mr-1 text-green-500" />
                              <span className="text-light-text">
                                {language === 'he' ? '₪' : '$'}{type.price}
                              </span>
                            </div>

                            <div className="flex items-center">
                              <Timer size={16} className="mr-1 text-blue-500" />
                              <span className="text-light-text">
                                {formatDuration(type.durationMS)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(type)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition"
                            aria-label="Edit"
                          >
                            <Edit size={18} />
                          </button>

                          <button
                            onClick={() => handleDelete(type)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                            aria-label="Delete"
                          >
                            <Trash size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-light-gray mb-4">
                      {language === 'he'
                        ? 'אין סוגי שירותים להצגה'
                        : 'No service types to display'
                      }
                    </p>
                    <Button
                      onClick={handleAddNew}
                      variant="primary"
                    >
                      {language === 'he' ? 'הוסף שירות חדש' : 'Add New Service'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default AppointmentTypes;
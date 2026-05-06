import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Timer, DollarSign, Tag } from 'lucide-react';
import { AppointmentType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { formatDuration } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useAppSelector } from '../hooks/useAppSelector';
import { createAppointmentType, deleteAppointmentType, fetchAppointmentTypes, updateAppointmentType } from '../store/slices/appointmentsSlice';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';

const AppointmentTypes: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentType, setCurrentType] = useState<AppointmentType | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', durationMS: '' });
  const { auth } = useAuth();
  const appointmentTypes = useAppSelector(state => state.appointments.appointmentTypes);
  const dispatch = useAppDispatch();

  document.title = t('appointmentTypes.title');

  useEffect(() => {
    if (appointmentTypes.length === 0 && auth.user) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id }))
        .finally(() => setIsLoading(false));
    } else setIsLoading(false);
  }, [appointmentTypes]);

  const handleAddNew = () => {
    setCurrentType(null);
    setFormData({ name: '', price: '', durationMS: '1800000' });
    setIsEditing(true);
  };

  const handleEdit = (type: AppointmentType) => {
    setCurrentType(type);
    setFormData({ name: type.name, price: type.price, durationMS: type.durationMS });
    setIsEditing(true);
  };

  const handleDelete = async (type: AppointmentType) => {
    if (!confirm(t('appointmentTypes.deleteConfirm', { name: type.name }))) return;

    try {
      await dispatch(deleteAppointmentType(type._id));
      toast.success(t('appointmentTypes.deleteSuccess'));
    } catch (error) {
      toast.error(t('appointmentTypes.deleteError'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'durationMinutes') {
      const minutes = parseInt(value) || 0;
      setFormData(prev => ({ ...prev, durationMS: (minutes * 60 * 1000).toString() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentType) {
        await dispatch(updateAppointmentType({ id: currentType._id, data: { ...formData } }));
        toast.success(t('appointmentTypes.updateSuccess'));
      } else {
        await dispatch(createAppointmentType({ ...formData, webConfig_id: auth.user.webConfig_id }));
        toast.success(t('appointmentTypes.addSuccess'));
      }
      setIsEditing(false);
    } catch (error) {
      toast.error(t('appointmentTypes.saveError'));
    }
  };

  const getDurationMinutes = () => Math.floor(parseInt(formData.durationMS) / 60000);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Tag className="text-primary w-5 h-5" />
          <h1 className="font-semibold text-xl text-gray-800 dark:text-white">
            {t('appointmentTypes.title')}
          </h1>
        </div>
        <p className="text-light-text dark:text-gray-400 text-sm mt-1 mb-2">
          {t('appointmentTypes.description')}
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
                {currentType ? t('appointmentTypes.editService') : t('appointmentTypes.newService')}
              </h3>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <Input
                    label={t('appointmentTypes.serviceName')}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    leftIcon={<Tag size={18} />}
                    required
                    autoFocus
                  />

                  <Input
                    label={t('appointmentTypes.price')}
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
                    label={t('appointmentTypes.duration')}
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
                  <Button type="button" variant="danger" onClick={() => setIsEditing(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" variant="primary">
                    {t('common.save')}
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
                {t('appointmentTypes.services')}
              </h3>
              <Button onClick={handleAddNew} leftIcon={<Plus size={16} />} variant="primary" size="sm">
                {t('appointmentTypes.addNew')}
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
                                {t('appointments.currencySymbol')}{type.price}
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
                            aria-label={t('common.edit')}
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(type)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                            aria-label={t('common.delete')}
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
                      {t('appointmentTypes.noServices')}
                    </p>
                    <Button onClick={handleAddNew} variant="primary">
                      {t('appointmentTypes.addNewService')}
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

import React from 'react';
import { motion } from 'framer-motion';
import { Scissors, Calendar, Shield, Palette, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { useTheme } from '../../contexts/ThemeContext';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { language, direction } = useTheme();
  
  const features = [
    {
      icon: <Calendar className="w-8 h-8 text-white" />,
      title: language === 'he' ? 'ניהול פגישות' : 'Appointment Management',
      description: language === 'he' 
        ? 'צפייה וניהול של כל הפגישות במקום אחד, כולל סטטוס ופרטי לקוח'
        : 'View and manage all appointments in one place, including status and client details'
    },
    {
      icon: <Shield className="w-8 h-8 text-white" />,
      title: language === 'he' ? 'אבטחה מתקדמת' : 'Advanced Security',
      description: language === 'he'
        ? 'מערכת מאובטחת עם הרשאות משתמשים והצפנת מידע'
        : 'Secure system with user permissions and data encryption'
    },
    {
      icon: <Palette className="w-8 h-8 text-white" />,
      title: language === 'he' ? 'התאמה אישית' : 'Customization',
      description: language === 'he'
        ? 'עיצוב מותאם אישית של האתר שלך, כולל צבעים, טקסטים ותמונות'
        : 'Custom design of your website, including colors, texts and images'
    }
  ];

  return (
    <div className={`min-h-screen bg-light-bg ${direction === 'rtl' ? 'rtl' : ''}`}>
      {/* Hero Section */}
      <div className="bg-light-surface">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-6"
            >
              <Scissors className="w-8 h-8 text-white" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl md:text-5xl font-bold text-light-text mb-4"
            >
              {language === 'he' ? 'מערכת ניהול פגישות' : 'Appointment Management System'}
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl text-light-text max-w-2xl mb-8"
            >
              {language === 'he'
                ? 'נהלו את העסק שלכם בקלות עם מערכת מתקדמת לניהול פגישות, התאמה אישית ומעקב אחר לקוחות'
                : 'Manage your business easily with an advanced system for appointment management, customization and client tracking'}
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                onClick={() => navigate('/login')}
                size="lg"
                rightIcon={direction === 'rtl' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
              >
                {language === 'he' ? 'התחברות למערכת' : 'Login to System'}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="bg-light-surface p-6 rounded-lg shadow-sm"
            >
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-light-text mb-2">
                {feature.title}
              </h3>
              <p className="text-light-text">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default LandingPage;
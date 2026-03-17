import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Key, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useTheme } from '../contexts/ThemeContext';

const Login: React.FC = () => {
  const { auth, login, loading } = useAuth();
  const { toggleDirection, direction, language, darkMode } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }
  document.title = language === "he" ? "התחברות" : "Login";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await login(username, password);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 bg-light-bg dark:bg-dark-bg transition-colors duration-200 ${direction === 'rtl' ? 'rtl-dir' : 'ltr-dir'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary bg-opacity-10 mb-4"
          >
            <Shield size={32} color="#fff"/>
          </motion.div>
          <h1 className="text-2xl font-bold text-light-text dark:text-dark-text mb-1">
            {language === 'he' ? 'ברוכים הבאים' : 'Welcome Back'}
          </h1>
          <p className="text-light-gray dark:text-dark-gray">
            {language === 'he' ? 'התחבר כדי לנהל את העסק שלך' : 'Sign in to manage your business'}
          </p>
        </div>

        <Card>
          {auth.error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-md mb-4 text-sm"
            >
              {language === 'he' ? 'שם משתמש או סיסמה שגויים' : 'Invalid username or password'}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <Input
                id="username"
                type="text"
                label={language === 'he' ? 'שם משתמש' : 'Username'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                leftIcon={<User size={18} className="text-light-gray dark:text-dark-gray" />}
                required
                placeholder={language === 'he' ? 'הזן שם משתמש' : 'Enter username'}
              />
            </div>

            <div className="mb-6">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                label={language === 'he' ? 'סיסמה' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Key size={18} className="text-light-gray dark:text-dark-gray" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="focus:outline-none text-light-gray dark:text-dark-gray hover:text-primary dark:hover:text-primary transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                required
                placeholder={language === 'he' ? 'הזן סיסמה' : 'Enter password'}
              />
            </div>

            <Button
              type="submit"
              isLoading={loading}
              fullWidth
            >
              {language === 'he' ? 'התחברות' : 'Sign In'}
            </Button>
          </form>
          
          {/* <div className="mt-4 flex justify-center">
            <button
              onClick={toggleDirection}
              className="text-sm text-primary transition-colors hover:underline"
            >
              {language === 'he' ? 'Switch to English' : 'החלף לעברית'}
            </button>
          </div> */}
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;
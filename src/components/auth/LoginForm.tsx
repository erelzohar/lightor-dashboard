import React, { useState } from 'react';
import { User, Key, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const LoginForm: React.FC = () => {
  const { login, loading, auth } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { language } = useTheme();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };
  
  return (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {auth.error && (
        <div className="bg-red-100 text-red-600 p-3 rounded-md text-sm">
          {language === 'he' ? 'שם משתמש או סיסמה שגויים' : 'Invalid username or password'}
        </div>
      )}
      
      <div>
        <Input
          label={language === 'he' ? 'שם משתמש' : 'Username'}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          leftIcon={<User size={18} />}
          placeholder={language === 'he' ? 'הזן שם משתמש' : 'Enter username'}
          autoFocus
          required
        />
      </div>
      
      <div>
        <Input
          label={language === 'he' ? 'סיסמה' : 'Password'}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Key size={18} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="focus:outline-none"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          placeholder={language === 'he' ? 'הזן סיסמה' : 'Enter password'}
          required
        />
      </div>
      
      <Button
        type="submit"
        isLoading={loading}
        fullWidth
        className="mt-6"
      >
        {language === 'he' ? 'התחברות' : 'Sign In'}
      </Button>
    </motion.form>
  );
};

export default LoginForm;
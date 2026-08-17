import React, { useState } from 'react';
import { User, Key, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useGoogleLogin } from '@react-oauth/google';
import FacebookLoginPkg from '@greatsumini/react-facebook-login';

// CJS/ESM interop: Vite may expose the whole module object as the default
const FacebookLogin =
  (FacebookLoginPkg as { default?: typeof FacebookLoginPkg }).default ?? FacebookLoginPkg;

const LoginForm: React.FC = () => {
  const { login, loginWithGoogle, loginWithFacebook, loading, auth } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { language } = useTheme();
  
  const googleLogin = useGoogleLogin({
    onSuccess: (codeResponse) => {
      loginWithGoogle(codeResponse.access_token);
    },
    onError: (error) => console.log('Login Failed:', error)
  });

  const responseFacebook = (response: { accessToken?: string }) => {
    if (response.accessToken) {
      loginWithFacebook(response.accessToken);
    }
  };
  
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

      <div className="relative mt-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
            {language === 'he' ? 'או' : 'Or'}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          type="button"
          onClick={() => googleLogin()}
          variant="secondary"
          fullWidth
          className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google
        </Button>
        <FacebookLogin
          appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
          onSuccess={responseFacebook}
          render={(renderProps: { onClick?: () => void }) => (
            <Button
              type="button"
              onClick={renderProps.onClick}
              variant="secondary"
              fullWidth
              className="flex items-center justify-center bg-[#1877F2] hover:bg-[#166fe5] text-white border-transparent"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </Button>
          )}
        />
      </div>
    </motion.form>
  );
};

export default LoginForm;
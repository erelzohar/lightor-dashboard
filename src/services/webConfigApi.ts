import axios from 'axios';
import { WebConfig } from '../types';
import globals from './globals';

// Create an axios instance with default config
const api = axios.create({
  baseURL: globals.webConfigsUrl,
});

// Add request interceptor to include the token with each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lightor');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getWebConfigById = async (id: string): Promise<WebConfig> => {
  if (!id) return;
  try {

    const res = await api.get(id);
    return res.data.data;
  } catch (err) {
    console.log(err);
    throw err;
  }
};


export const createWebConfig = async (
  webConfig: Partial<WebConfig>
): Promise<WebConfig> => {
  try {
    const res = await api.post('', webConfig);
    return res.data.data;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

export const updateWebConfig = async (
  webConfig: Partial<WebConfig> & { _id: string }
): Promise<WebConfig> => {
  try {
    const res = await api.put(webConfig._id, webConfig);
    return res.data.data;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

export const checkSubdomainAvailability = async (subdomain: string): Promise<boolean> => {
  try {
    const res = await api.get(`/check-subdomain/${subdomain}`);
    return res.data.available;
  } catch (err: any) {
    if (err.response?.status === 409 || err.response?.status === 400) {
      return false;
    }
    console.log(err);
    throw err;
  }
};
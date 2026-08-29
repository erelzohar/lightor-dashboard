import apiClient from './apiClient';
import { WebConfig } from '../types';
import globals from './globals';

const URL = globals.webConfigsUrl;

export const getWebConfigById = async (id: string): Promise<WebConfig> => {
  if (!id) return;
  try {

    const res = await apiClient.get(`${URL}${id}`);
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
    const res = await apiClient.post(URL, webConfig);
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
    const res = await apiClient.put(`${URL}${webConfig._id}`, webConfig);
    return res.data.data;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

export const checkSubdomainAvailability = async (subdomain: string): Promise<boolean> => {
  try {
    const res = await apiClient.get(`${URL}check-subdomain/${subdomain}`);
    return res.data.available;
  } catch (err: any) {
    if (err.response?.status === 409 || err.response?.status === 400) {
      return false;
    }
    console.log(err);
    throw err;
  }
};
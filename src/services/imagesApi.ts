import axios from 'axios';
import globals from './globals';
import { install401Handler } from './authInterceptor';

// Create axios instance
const api = axios.create({
    baseURL: globals.imagesUrl, // e.g., https://api.yourdomain.com/images
    withCredentials: true,
});
install401Handler(api);

// LT-009: the session now rides an HttpOnly cookie (withCredentials). This
// Bearer interceptor is a transition shim for sessions that predate the
// cookie — AuthContext migrates them at startup and clears localStorage, so
// this finds nothing on any session created after LT-009. Delete it (and the
// other copies of it) once pre-cookie tokens have aged out: 2027-02.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('lightor');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Upload a single image
 * @param file The image file (from input)
 * @returns Uploaded image data (e.g., { url, name, id })
 */
export const uploadImage = async (file: File): Promise<{ imageName: string }> => {
    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await api.post('/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        return res.data.data;
    } catch (err) {
        console.error('Failed to upload image:', err);
        throw err;
    }
};

/**
 * Get image metadata by ID
 */
export const getImageById = async (id: string): Promise<{ url: string; name: string; id: string }> => {
    try {
        const res = await api.get(id);
        return res.data.data;
    } catch (err) {
        console.error('Failed to fetch image:', err);
        throw err;
    }
};

/**
 * Delete an image by ID
 */
export const deleteImage = async (id: string): Promise<void> => {
    try {
        await api.delete(id);
    } catch (err) {
        console.error('Failed to delete image:', err);
        throw err;
    }
};

/**
 * Import a photo the browser cannot fetch itself — Meta's CDN sends no CORS
 * headers, so the server pulls it, runs it through the same resize/webp
 * pipeline as manual uploads, and answers with the stored name. (LT-010)
 */
export const importImageFromUrl = async (url: string): Promise<{ imageName: string }> => {
    const res = await api.post('/import-from-url', { url });
    return res.data.data;
};

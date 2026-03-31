import axios from 'axios';
import globals from './globals';

// Create axios instance
const api = axios.create({
    baseURL: globals.imagesUrl, // e.g., https://api.yourdomain.com/images
});

// Add token to each request
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

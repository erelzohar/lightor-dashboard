import apiClient from './apiClient';
import globals from './globals';

const URL = globals.imagesUrl;

/**
 * Upload a single image
 * @param file The image file (from input)
 * @returns Uploaded image data (e.g., { url, name, id })
 */
export const uploadImage = async (file: File): Promise<{ imageName: string }> => {
    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await apiClient.post(URL, formData, {
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
        const res = await apiClient.get(`${URL}${id}`);
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
        await apiClient.delete(`${URL}${id}`);
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
    const res = await apiClient.post(`${URL}import-from-url`, { url });
    return res.data.data;
};

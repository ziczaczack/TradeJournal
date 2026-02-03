import { getSupabase } from './supabase';

const BUCKET_NAME = 'trade-screenshots';

/**
 * Compress an image file using browser-image-compression
 * @param file Original image file
 * @returns Compressed file (max 1MB)
 */
export async function compressImage(file: File): Promise<File> {
    // Dynamic import to avoid SSR issues
    const imageCompression = (await import('browser-image-compression')).default;

    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/png' as const,
    };

    try {
        const compressedFile = await imageCompression(file, options);
        return compressedFile;
    } catch (error) {
        console.warn('Image compression failed, using original:', error);
        return file;
    }
}

/**
 * Upload a screenshot to Supabase Storage
 * @param file Image file to upload
 * @param userId User ID for folder organization
 * @param tradeId Trade ID for subfolder organization
 * @returns Public URL of the uploaded file
 */
export async function uploadScreenshot(
    file: File,
    userId: string,
    tradeId: string
): Promise<string> {
    const supabase = getSupabase();

    // Compress the image before upload
    const compressedFile = await compressImage(file);

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const extension = 'png';
    const filePath = `${userId}/${tradeId}/${timestamp}.${extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, compressedFile, {
            contentType: 'image/png',
            upsert: false,
        });

    if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload screenshot: ${uploadError.message}`);
    }

    // Get the public URL
    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

/**
 * Delete a screenshot from Supabase Storage
 * @param url Public URL of the screenshot to delete
 */
export async function deleteScreenshot(url: string): Promise<void> {
    const supabase = getSupabase();

    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
    const urlParts = url.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    if (urlParts.length !== 2) {
        console.warn('Invalid screenshot URL format:', url);
        return;
    }

    const filePath = decodeURIComponent(urlParts[1]);

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete screenshot: ${error.message}`);
    }
}

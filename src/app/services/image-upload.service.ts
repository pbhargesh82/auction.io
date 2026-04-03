import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ImageUploadService {
    // Signals for upload state
    private _uploading = signal(false);
    private _progress = signal(0);
    private _error = signal<string | null>(null);

    // Public readonly signals
    uploading = this._uploading.asReadonly();
    progress = this._progress.asReadonly();
    error = this._error.asReadonly();

    // Computed signal for upload status text
    statusText = computed(() => {
        if (this._uploading()) {
            return `Uploading... ${this._progress()}%`;
        }
        if (this._error()) {
            return this._error();
        }
        return 'Ready';
    });

    constructor(private supabaseService: SupabaseService) { }

    /**
     * Upload an image file to Supabase Storage
     * @param file - The file to upload
     * @param folder - The folder path (e.g., 'teams', 'players')
     * @param fileName - Optional custom filename (defaults to timestamp + original name)
     */
    async uploadImage(file: File, folder: string, fileName?: string): Promise<UploadResult> {
        this._uploading.set(true);
        this._progress.set(0);
        this._error.set(null);

        try {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                throw new Error('Please select an image file');
            }

            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                throw new Error('Image size must be less than 5MB');
            }

            // Get current user ID for folder organization
            const user = this.supabaseService.currentUserValue;
            if (!user) {
                throw new Error('You must be logged in to upload images');
            }

            // Generate unique filename
            const timestamp = Date.now();
            const extension = file.name.split('.').pop();
            const uniqueFileName = fileName || `${timestamp}_${file.name}`;
            const filePath = `${user.id}/${folder}/${uniqueFileName}`;

            this._progress.set(30);

            // Upload to Supabase Storage
            const { data, error } = await this.supabaseService.db.storage
                .from('images')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                throw new Error(error.message);
            }

            this._progress.set(80);

            // Get public URL
            const { data: urlData } = this.supabaseService.db.storage
                .from('images')
                .getPublicUrl(filePath);

            this._progress.set(100);
            this._uploading.set(false);

            return {
                success: true,
                url: urlData.publicUrl
            };
        } catch (err: any) {
            this._error.set(err.message);
            this._uploading.set(false);
            return {
                success: false,
                error: err.message
            };
        }
    }

    /**
     * Delete an image from Supabase Storage
     * @param imageUrl - The public URL of the image to delete
     */
    async deleteImage(imageUrl: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Extract file path from URL
            const url = new URL(imageUrl);
            const pathParts = url.pathname.split('/storage/v1/object/public/images/');
            if (pathParts.length !== 2) {
                throw new Error('Invalid image URL');
            }
            const filePath = pathParts[1];

            const { error } = await this.supabaseService.db.storage
                .from('images')
                .remove([filePath]);

            if (error) {
                throw new Error(error.message);
            }

            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Compress and resize an image before upload (client-side)
     * @param file - The original file
     * @param maxWidth - Maximum width in pixels
     * @param quality - JPEG quality (0-1)
     */
    async compressImage(file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Calculate new dimensions
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Could not compress image'));
                                return;
                            }
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = () => reject(new Error('Could not load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Could not read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Clear error state
     */
    clearError(): void {
        this._error.set(null);
    }

    /**
     * Reset all states
     */
    reset(): void {
        this._uploading.set(false);
        this._progress.set(0);
        this._error.set(null);
    }
}

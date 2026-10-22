/** Satu instance penyimpanan selfie untuk seluruh server: folder `uploads/selfies` di folder tempat server dijalankan. */
import { join } from 'node:path';
import { createDiskSelfieStorage } from './selfie-storage';

export const selfieStorage = createDiskSelfieStorage(join(process.cwd(), 'uploads', 'selfies'));

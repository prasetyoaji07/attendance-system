import { z } from 'zod';
import { DEVICE_ID_PATTERN } from '../../utils/device-binding';

export const registerDeviceSchema = z.object({
  deviceId: z.string().regex(DEVICE_ID_PATTERN, 'ID perangkat tidak valid. Muat ulang aplikasi, lalu coba lagi.'),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');

export { dayjs };
export const ISO = 'YYYY-MM-DD';
/** 'HH:mm:ss' atau 'HH:mm' dari server menjadi 'HH:mm'. */
export const hhmm = (t: string) => t.slice(0, 5);

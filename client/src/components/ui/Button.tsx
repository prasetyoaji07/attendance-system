import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-md select-none ' +
  'transition-all duration-[120ms] ease-out focus-visible:outline-none ' +
  'focus-visible:ring-[3px] focus-visible:ring-primary-200 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-grad-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_0_var(--primary-700),0_10px_20px_rgba(99,102,241,.3)] ' +
    'hover:-translate-y-0.5 active:translate-y-[3px] ' +
    'active:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_1px_0_var(--primary-700)]',
  secondary: 'bg-surface text-text border border-border shadow-1 hover:shadow-2 hover:-translate-y-0.5',
  ghost: 'text-primary-600 hover:bg-primary-50',
  danger:
    'bg-gradient-to-b from-rose-400 to-rose-600 text-white ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_0_#BE123C] active:translate-y-[3px] active:shadow-[0_1px_0_#BE123C]',
  success:
    'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_0_#047857] active:translate-y-[3px] active:shadow-[0_1px_0_#047857]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-body',
  lg: 'h-[52px] px-6 text-body-lg font-bold',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', className = '', ...rest }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />
  ),
);
Button.displayName = 'Button';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-md select-none ' +
  'transition duration-[120ms] ease-out focus-visible:outline-none ' +
  'focus-visible:ring-[3px] focus-visible:ring-primary-200 ' +
  'enabled:active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary: 'bg-contrast-bg text-contrast-text hover:bg-primary-600 hover:text-white',
  secondary: 'bg-surface-2 text-text hover:bg-border',
  ghost: 'text-primary-600 hover:bg-primary-50',
  danger: 'bg-danger text-white hover:brightness-90',
  success: 'bg-success text-white hover:brightness-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-body-sm',
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
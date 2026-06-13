import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-bold tracking-wide transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20 border border-primary/40',
    secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border',
    danger: 'bg-destructive hover:opacity-90 text-destructive-foreground shadow-lg shadow-destructive/20 border border-destructive/40',
    ghost: 'hover:bg-accent hover:text-accent-foreground text-muted-foreground',
    glass: 'bg-card/40 backdrop-blur-md hover:bg-card/60 border border-border/50 text-foreground'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

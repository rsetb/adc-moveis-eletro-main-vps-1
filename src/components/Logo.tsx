
'use client';
import React from 'react';
import Image from 'next/image';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/lib/utils';

const DefaultLogo = ({ name, onDark }: { name: string; onDark?: boolean }) => (
    <div className="flex items-center gap-2">
        <div
            className={cn(
                'rounded-md w-11 h-11 flex items-center justify-center font-extrabold text-xl',
                onDark ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'
            )}
        >
            {name.charAt(0).toUpperCase()}
        </div>
        <span
            className={cn(
                'font-bold text-xl leading-tight max-w-[180px] truncate',
                onDark ? 'text-white' : 'text-primary'
            )}
        >
            {name}
        </span>
    </div>
);

/**
 * onDark: usar quando o logo fica sobre fundo azul (header).
 * Logo em imagem ganha um fundo branco arredondado para manter contraste.
 */
const Logo = ({ onDark = false }: { onDark?: boolean }) => {
    const { settings, isLoading } = useSettings();

    if (isLoading) {
        return <div className="h-12 w-40" />;
    }

    if (settings.logoUrl) {
        return (
            <span className={cn('inline-flex items-center', onDark && 'bg-white rounded-lg px-2 py-1')}>
                <Image
                    src={settings.logoUrl}
                    alt={settings.storeName}
                    width={320}
                    height={96}
                    className={cn('w-auto object-contain object-left', onDark ? 'h-10 md:h-12' : 'h-14')}
                    style={{ maxWidth: '260px' }}
                />
            </span>
        );
    }

    return <DefaultLogo name={settings.storeName || 'Catálogo'} onDark={onDark} />;
};

export default Logo;

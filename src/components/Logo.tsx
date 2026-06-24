
'use client';
import React from 'react';
import Image from 'next/image';
import { useSettings } from '@/context/SettingsContext';

const DefaultLogo = ({ name }: { name: string }) => (
    <div className="flex items-center gap-2">
        <div className="bg-primary text-primary-foreground rounded-md w-9 h-9 flex items-center justify-center font-extrabold text-lg">
            {name.charAt(0).toUpperCase()}
        </div>
        <span className="font-bold text-lg text-primary leading-tight max-w-[140px] truncate">
            {name}
        </span>
    </div>
);

const Logo = () => {
    const { settings, isLoading } = useSettings();

    // Enquanto carrega, mostra placeholder transparente para evitar flash da logo antiga
    if (isLoading) {
        return <div className="w-44 h-16" />;
    }

    if (settings.logoUrl) {
        return (
            <div className="relative w-44 h-16">
                <Image
                    src={settings.logoUrl}
                    alt={settings.storeName}
                    fill
                    className="object-contain"
                    sizes="176px"
                />
            </div>
        );
    }

    return <DefaultLogo name={settings.storeName || 'Catálogo'} />;
};

export default Logo;

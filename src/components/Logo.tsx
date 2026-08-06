
'use client';
import React from 'react';
import Image from 'next/image';
import { useSettings } from '@/context/SettingsContext';

const DefaultLogo = ({ name }: { name: string }) => (
    <div className="flex items-center gap-2">
        <div className="bg-primary text-primary-foreground rounded-md w-11 h-11 flex items-center justify-center font-extrabold text-xl">
            {name.charAt(0).toUpperCase()}
        </div>
        <span className="font-bold text-xl text-primary leading-tight max-w-[180px] truncate">
            {name}
        </span>
    </div>
);

const Logo = () => {
    const { settings, isLoading } = useSettings();

    if (isLoading) {
        return <div className="h-14 w-48" />;
    }

    if (settings.logoUrl) {
        return (
            <Image
                src={settings.logoUrl}
                alt={settings.storeName}
                width={320}
                height={96}
                className="h-14 w-auto object-contain object-left"
                style={{ maxWidth: '320px' }}
            />
        );
    }

    return <DefaultLogo name={settings.storeName || 'Catálogo'} />;
};

export default Logo;

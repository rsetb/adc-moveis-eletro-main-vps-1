
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Clock, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/context/SettingsContext';

function PedidoContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { settings } = useSettings();

  const handleWhatsAppClick = () => {
    if (!id) return;
    
    const storePhone = settings?.storePhone?.replace(/\D/g, '') || '5588999999999'; // Fallback phone if not set
    const message = `Olá! Acabei de fazer uma solicitação de pedido no site. ID: ${id}. Poderia confirmar?`;
    const whatsappLink = `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappLink, '_blank');
  };

  return (
    <Card className="max-w-lg w-full shadow-lg">
      <CardHeader className="text-center bg-primary/5 rounded-t-lg p-8">
        <Clock className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
        <CardTitle className="text-2xl font-headline text-primary">Solicitação Enviada!</CardTitle>
        <CardDescription className="text-lg mt-2">
          Recebemos seu pedido e ele está em análise.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          Seu pedido foi registrado temporariamente e aguarda confirmação de um vendedor.
          Assim que aprovado, você receberá a confirmação.
        </p>
        
        {id && (
          <div className="bg-muted p-4 rounded-lg inline-block">
            <p className="text-sm font-semibold text-muted-foreground mb-1">ID da Solicitação</p>
            <Badge variant="secondary" className="text-base px-3 py-1 font-mono">
              {id.split('-')[0]}...
            </Badge>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 mt-6">
          <p>
            <strong>Nota:</strong> O estoque dos produtos será reservado apenas após a confirmação do vendedor.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center p-6 bg-muted/30 rounded-b-lg">
        <Button 
          size="lg" 
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white gap-2"
          onClick={handleWhatsAppClick}
        >
          <MessageCircle className="h-5 w-5" />
          Avisar no WhatsApp
        </Button>
        <Link href="/" className="w-full sm:w-auto">
          <Button variant="outline" size="lg" className="w-full">
            Voltar para o Catálogo
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function PedidoRecebidoPage() {
  return (
    <div className="container mx-auto py-12 px-4 flex items-center justify-center min-h-[60vh]">
      <Suspense fallback={<div className="text-center">Carregando detalhes do pedido...</div>}>
        <PedidoContent />
      </Suspense>
    </div>
  );
}

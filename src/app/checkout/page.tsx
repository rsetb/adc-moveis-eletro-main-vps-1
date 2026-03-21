
import CheckoutForm from '@/components/CheckoutForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CheckoutPage() {
    return (
        <div className="container mx-auto py-12 px-4">
            <Card className="max-w-4xl mx-auto shadow-lg">
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="text-3xl font-headline text-primary">Finalizar Compra</CardTitle>
                        <CardDescription>
                            Por favor, preencha suas informações e escolha a forma de pagamento.
                        </CardDescription>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Ver Catálogo
                        </Link>
                    </Button>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                    <CheckoutForm />
                </CardContent>
            </Card>
        </div>
    );
}

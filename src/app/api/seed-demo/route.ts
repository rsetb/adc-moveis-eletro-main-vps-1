import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const categories = [
  { name: 'Sofás e Poltronas', subcategories: ['Sofás', 'Poltronas', 'Chaises'] },
  { name: 'Quartos', subcategories: ['Camas', 'Guarda-roupas', 'Cômodas', 'Criados-mudos'] },
  { name: 'Salas de Jantar', subcategories: ['Mesas', 'Cadeiras', 'Aparadores'] },
  { name: 'Eletrodomésticos', subcategories: ['Geladeiras', 'Fogões', 'Máquinas de Lavar', 'Micro-ondas'] },
  { name: 'Eletrônicos', subcategories: ['TVs', 'Áudio', 'Celulares'] },
];

const products = [
  // Sofás
  { name: 'Sofá Retrátil 3 Lugares', category: 'Sofás e Poltronas', subcategory: 'Sofás', price: 1899.90, stock: 8, description: 'Sofá retrátil e reclinável em tecido suede, 3 lugares, conforto e estilo para sua sala.', maxInstallments: 12 },
  { name: 'Sofá de Canto em L', category: 'Sofás e Poltronas', subcategory: 'Sofás', price: 2699.90, originalPrice: 3200.00, onSale: true, stock: 5, description: 'Sofá de canto em L com chaise, revestimento em tecido veludo, ideal para salas grandes.', maxInstallments: 12 },
  { name: 'Poltrona Reclinável Luxo', category: 'Sofás e Poltronas', subcategory: 'Poltronas', price: 899.90, stock: 12, description: 'Poltrona reclinável com sistema de massagem, couro ecológico, suporte para pés integrado.', maxInstallments: 10 },
  { name: 'Chaise Longue Moderna', category: 'Sofás e Poltronas', subcategory: 'Chaises', price: 1299.90, stock: 4, description: 'Chaise longue em tecido linho, design escandinavo, estrutura em madeira maciça.', maxInstallments: 10 },

  // Quartos
  { name: 'Cama Box Casal Queen 1,58m', category: 'Quartos', subcategory: 'Camas', price: 1499.90, stock: 10, description: 'Cama box com colchão molas ensacadas queen size, pillow top dupla face, 10 anos de garantia.', maxInstallments: 12 },
  { name: 'Cama Box Solteiro com Gavetas', category: 'Quartos', subcategory: 'Camas', price: 799.90, stock: 15, description: 'Cama box solteiro com 2 gavetas de armazenamento, colchão D33, estrutura reforçada.', maxInstallments: 10 },
  { name: 'Guarda-roupa 6 Portas Espelhado', category: 'Quartos', subcategory: 'Guarda-roupas', price: 2199.90, originalPrice: 2600.00, onSale: true, stock: 6, description: 'Guarda-roupa 6 portas com espelho, 100% MDF, 3 gavetas internas, cabideiro duplo.', maxInstallments: 12 },
  { name: 'Cômoda 5 Gavetas Retrô', category: 'Quartos', subcategory: 'Cômodas', price: 699.90, stock: 9, description: 'Cômoda 5 gavetas estilo retrô em MDF, puxadores dourados, espelho incluso.', maxInstallments: 8 },
  { name: 'Criado-mudo com Gaveta e Nicho', category: 'Quartos', subcategory: 'Criados-mudos', price: 249.90, stock: 20, description: 'Criado-mudo com 1 gaveta e 1 nicho aberto, MDF 15mm, disponível em várias cores.', maxInstallments: 6 },

  // Salas de Jantar
  { name: 'Mesa de Jantar 6 Cadeiras', category: 'Salas de Jantar', subcategory: 'Mesas', price: 1899.90, stock: 5, description: 'Conjunto mesa de jantar retangular 1,60m com 6 cadeiras estofadas, tampo em vidro temperado.', maxInstallments: 12 },
  { name: 'Mesa de Jantar Extensível', category: 'Salas de Jantar', subcategory: 'Mesas', price: 1299.90, stock: 7, description: 'Mesa extensível de 1,20m a 1,60m, pés de aço inox, tampo em MDP revestido.', maxInstallments: 10 },
  { name: 'Aparador Buffet 3 Portas', category: 'Salas de Jantar', subcategory: 'Aparadores', price: 899.90, stock: 8, description: 'Aparador buffet 3 portas em MDF, 2 gavetas, pés palito em madeira maciça.', maxInstallments: 8 },

  // Eletrodomésticos
  { name: 'Geladeira Frost Free 410L', category: 'Eletrodomésticos', subcategory: 'Geladeiras', price: 2899.90, originalPrice: 3299.90, onSale: true, stock: 7, description: 'Geladeira duplex frost free 410L, painel eletrônico, prateleiras de vidro temperado, dispenser de água.', maxInstallments: 12 },
  { name: 'Fogão 5 Bocas Inox', category: 'Eletrodomésticos', subcategory: 'Fogões', price: 1299.90, stock: 11, description: 'Fogão 5 bocas em inox, acendimento automático, forno com grill, timer digital.', maxInstallments: 10 },
  { name: 'Máquina de Lavar 12kg', category: 'Eletrodomésticos', subcategory: 'Máquinas de Lavar', price: 1799.90, stock: 9, description: 'Máquina de lavar 12kg, 12 programas de lavagem, tecnologia inverter, display digital.', maxInstallments: 12 },
  { name: 'Micro-ondas 32L Inox', category: 'Eletrodomésticos', subcategory: 'Micro-ondas', price: 599.90, stock: 14, description: 'Micro-ondas 32L em inox, 10 níveis de potência, função grill, timer 99 minutos.', maxInstallments: 8 },
  { name: 'Lava-louças 14 Serviços', category: 'Eletrodomésticos', subcategory: 'Geladeiras', price: 2199.90, stock: 4, description: 'Lava-louças 14 serviços, 5 programas de lavagem, sistema de secagem por condensação.', maxInstallments: 12 },

  // Eletrônicos
  { name: 'Smart TV 55" 4K QLED', category: 'Eletrônicos', subcategory: 'TVs', price: 3499.90, originalPrice: 4200.00, onSale: true, stock: 6, description: 'Smart TV 55 polegadas 4K QLED, Wi-Fi, Bluetooth, sistema operacional intuitivo, 3 entradas HDMI.', maxInstallments: 12 },
  { name: 'Smart TV 43" Full HD', category: 'Eletrônicos', subcategory: 'TVs', price: 1699.90, stock: 10, description: 'Smart TV 43" Full HD, streaming integrado, controle por voz, design slim sem bordas.', maxInstallments: 12 },
  { name: 'Soundbar 2.1 com Subwoofer', category: 'Eletrônicos', subcategory: 'Áudio', price: 899.90, stock: 8, description: 'Soundbar 2.1 canais com subwoofer sem fio, Bluetooth 5.0, 300W RMS, entrada óptica e HDMI ARC.', maxInstallments: 10 },
  { name: 'Smartphone 128GB', category: 'Eletrônicos', subcategory: 'Celulares', price: 1299.90, originalPrice: 1599.90, onSale: true, stock: 15, description: 'Smartphone 128GB, câmera tripla 50MP, bateria 5000mAh, carregamento rápido 65W, tela AMOLED 6.7".', maxInstallments: 12 },
];

export async function GET() {
  try {
    const catCount = await db.category.count();
    const prodCount = await db.product.count();

    if (catCount > 0 || prodCount > 0) {
      return NextResponse.json({
        success: false,
        error: 'Banco já tem dados. Rota de seed desabilitada para evitar duplicação.',
        categorias: catCount,
        produtos: prodCount,
      }, { status: 403 });
    }

    // Criar categorias
    for (const cat of categories) {
      await db.category.create({
        data: {
          name: cat.name,
          order: categories.indexOf(cat),
          subcategories: cat.subcategories,
        },
      });
    }

    // Criar produtos
    for (const p of products) {
      await db.product.create({
        data: {
          name: p.name,
          category: p.category,
          subcategory: p.subcategory,
          price: p.price,
          originalPrice: p.originalPrice ?? null,
          onSale: p.onSale ?? false,
          stock: p.stock,
          description: p.description,
          maxInstallments: p.maxInstallments,
          imageUrl: `https://placehold.co/600x400/1a365d/ffffff?text=${encodeURIComponent(p.name)}`,
          commissionType: 'percentage',
          commissionValue: 5,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Dados de demonstração criados com sucesso!',
      categorias: categories.length,
      produtos: products.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

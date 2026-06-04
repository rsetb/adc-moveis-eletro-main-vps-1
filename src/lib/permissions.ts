
import type { UserRole, AppSection, RolePermissions } from './types';

export const ALL_SECTIONS: { id: AppSection, label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'relatorios-vendas',     label: 'Rel. Vendas'     },
    { id: 'relatorios-produtos',   label: 'Rel. Produtos'   },
    { id: 'relatorios-clientes',   label: 'Rel. Clientes'   },
    { id: 'relatorios-financeiro', label: 'Rel. Financeiro' },
    { id: 'cobrancas', label: 'Cobranças' },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'criar-pedido', label: 'Criar Pedido' },
    { id: 'solicitacoes', label: 'Solicitações' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'produtos', label: 'Produtos' },
    { id: 'categorias', label: 'Categorias' },
    { id: 'avarias', label: 'Avarias' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'minhas-comissoes', label: 'Minhas Comissões' },
    { id: 'pastas', label: 'Pastas' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'caixa', label: 'Caixa' },
    { id: 'validar-pix', label: 'Validar PIX' },
    { id: 'auditoria', label: 'Auditoria' },
    { id: 'configuracao', label: 'Configurações' },
    { id: 'usuarios', label: 'Usuários' },
];

export const initialPermissions: RolePermissions = {
    vendedor: [
        'dashboard',
        'relatorios-vendas',
        'pedidos',
        'criar-pedido',
        'solicitacoes',
        'clientes',
        'produtos',
        'minhas-comissoes',
        'avarias',
        'pastas',
    ],
    vendedor_cobranca: [
        'dashboard',
        'pedidos',
        'cobrancas',
        'criar-pedido',
        'solicitacoes',
        'clientes',
        'produtos',
        'minhas-comissoes',
        'pastas',
    ],
    vendedor_externo: [
        'minhas-comissoes',
        'pastas',
    ],
    gerente: [
        'dashboard',
        'relatorios-vendas',
        'relatorios-produtos',
        'relatorios-clientes',
        'relatorios-financeiro',
        'pedidos',
        'cobrancas',
        'criar-pedido',
        'solicitacoes',
        'clientes',
        'produtos',
        'categorias',
        'avarias',
        'estoque',
        'caixa',
        'financeiro',
        'minhas-comissoes',
        'pastas',
        'auditoria',
        'configuracao',
    ],
    admin: [
        'dashboard',
        'relatorios-vendas',
        'relatorios-produtos',
        'relatorios-clientes',
        'relatorios-financeiro',
        'pedidos',
        'cobrancas',
        'criar-pedido',
        'solicitacoes',
        'clientes',
        'produtos',
        'categorias',
        'avarias',
        'estoque',
        'caixa',
        'financeiro',
        'minhas-comissoes',
        'pastas',
        'auditoria',
        'configuracao',
        'usuarios',
    ],
};


export function hasAccess(role: UserRole, section: AppSection, permissions: RolePermissions): boolean {
    if (role === 'vendedor_externo') return section === 'minhas-comissoes' || section === 'pastas';
    if (role === 'admin') return true; // Admin always has access
    if (role === 'gerente' && section === 'financeiro') return true;
    if (role === 'vendedor' && section === 'produtos') return true;
    const rolePermissions = permissions[role];
    if (!rolePermissions) {
        return false;
    }
    return rolePermissions.includes(section);
}

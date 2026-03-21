
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key in .env.local');
    console.error('Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const prisma = new PrismaClient();

// Helper to convert snake_case to camelCase
function toCamelCase(str: string): string {
    return str.replace(/([-_][a-z])/g, (group) =>
        group.toUpperCase().replace('-', '').replace('_', '')
    );
}

// Helper to recursively normalize keys in an object/array
function deepNormalizeKeys(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(v => deepNormalizeKeys(v));
    } else if (typeof obj === 'object') {
        return Object.keys(obj).reduce((result, key) => {
            const camelKey = toCamelCase(key);
            result[camelKey] = deepNormalizeKeys(obj[key]);
            return result;
        }, {} as any);
    }
    return obj;
}

// Updated signature to support separate Create vs Update logic
async function migrateTable(
    tableName: string,
    prismaModel: any,
    createTransform: (row: any) => any,
    idField: string = 'id',
    updateTransform?: (row: any) => any
) {
    console.log(`\n📦 Migrating ${tableName}...`);

    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    let totalSuccess = 0;
    let totalError = 0;

    while (hasMore) {
        console.log(`   Fetching page ${page + 1} (Rows ${page * pageSize} to ${(page + 1) * pageSize - 1})...`);

        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error(`❌ Error fetching ${tableName} page ${page}:`, error.message);
            break;
        }

        if (!data || data.length === 0) {
            if (page === 0) console.log(`⚠️ No data found in ${tableName}`);
            hasMore = false;
            break;
        }

        // Process this batch
        for (const row of data) {
            try {
                // Determine data for Create vs Update
                const createData = createTransform(row);
                const updateData = updateTransform ? updateTransform(row) : createData;

                const whereClause: any = {};
                whereClause[idField] = row[idField] || createData[idField];

                await prismaModel.upsert({
                    where: whereClause,
                    update: updateData,
                    create: createData,
                });

                if (totalSuccess % 50 === 0) process.stdout.write('.');
                totalSuccess++;
            } catch (e: any) {
                totalError++;
                console.error(`\n❌ Failed to insert ${tableName} ID ${row[idField]}:`, e.message);
            }
        }

        if (data.length < pageSize) {
            hasMore = false;
        } else {
            page++;
        }
    }

    console.log(`\n✅ Finished ${tableName}: ${totalSuccess} inserted, ${totalError} failed.`);
}

async function main() {
    try {
        console.log('🚀 Starting Migration from Supabase to Local PostgreSQL...');

        // 1. Users
        await migrateTable('users', prisma.user, (row) => ({
            id: row.id,
            username: row.username,
            password: row.password,
            name: row.name,
            role: row.role,
            canBeAssigned: (row.can_be_assigned ?? row.canBeAssigned) ?? true,
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
        }));

        // 2. Categories
        await migrateTable('categories', prisma.category, (row) => ({
            id: row.id,
            name: row.name,
            order: row.order,
            subcategories: deepNormalizeKeys(row.subcategories),
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
        }));

        // 3. Products
        const productTransform = (row: any) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description,
            longDescription: row.long_description ?? row.longDescription,
            price: row.price,
            originalPrice: row.original_price ?? row.originalPrice,
            cost: row.cost,
            onSale: row.on_sale ?? row.onSale,
            promotionEndDate: row.promotion_end_date ?? row.promotionEndDate,
            isHidden: row.is_hidden ?? row.isHidden,
            category: row.category,
            subcategory: row.subcategory,
            stock: row.stock,
            minStock: row.min_stock ?? row.minStock,
            unit: row.unit,
            imageUrl: row.image_url ?? row.imageUrl,
            imageUrls: deepNormalizeKeys(row.image_urls ?? row.imageUrls),
            maxInstallments: row.max_installments ?? row.maxInstallments,
            paymentCondition: row.payment_condition ?? row.paymentCondition,
            commissionType: row.commission_type ?? row.commissionType,
            commissionValue: row.commission_value ?? row.commissionValue,
            dataAiHint: row.data_ai_hint ?? row.dataAiHint,
            deletedAt: row.deleted_at ?? row.deletedAt,
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
        });

        const productUpdateTransform = (row: any) => {
            const data = productTransform(row);
            // Remove stock fields from update payload to preserve local changes
            delete (data as any).stock;
            delete (data as any).minStock;
            return data;
        };

        await migrateTable('products', prisma.product, productTransform, 'id', productUpdateTransform);

        // 4. Customers
        await migrateTable('customers', prisma.customer, (row) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            cpf: row.cpf,
            phone: row.phone,
            phone2: row.phone2,
            phone3: row.phone3,
            email: row.email,
            zip: row.zip,
            address: row.address,
            number: row.number,
            complement: row.complement,
            neighborhood: row.neighborhood,
            city: row.city,
            state: row.state,
            password: row.password,
            observations: row.observations,
            sellerId: row.seller_id ?? row.sellerId,
            sellerName: row.seller_name ?? row.sellerName,
            blocked: row.blocked,
            blockedReason: row.blocked_reason ?? row.blockedReason,
            rating: row.rating,
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
        }));

        // 5. Orders
        await migrateTable('orders', prisma.order, (row) => ({
            id: row.id,
            customer: deepNormalizeKeys(row.customer),
            items: deepNormalizeKeys(row.items),
            total: row.total,
            subtotal: row.subtotal,
            discount: row.discount,
            downPayment: row.down_payment ?? row.downPayment,
            deliveryFee: row.delivery_fee ?? row.deliveryFee,
            installments: row.installments,
            installmentValue: row.installment_value ?? row.installmentValue,
            date: row.date,
            firstDueDate: row.first_due_date ?? row.firstDueDate,
            status: row.status,
            paymentMethod: row.payment_method ?? row.paymentMethod,
            installmentDetails: deepNormalizeKeys(row.installment_details ?? row.installmentDetails),
            installmentCardDetails: deepNormalizeKeys(row.installment_card_details ?? row.installmentCardDetails),
            trackingCode: row.tracking_code ?? row.trackingCode,
            attachments: deepNormalizeKeys(row.attachments),
            sellerId: row.seller_id ?? row.sellerId,
            sellerName: row.seller_name ?? row.sellerName,
            commission: row.commission,
            commissionDate: row.commission_date ?? row.commissionDate,
            commissionPaid: row.commission_paid ?? row.commissionPaid,
            isCommissionManual: row.is_commission_manual ?? row.isCommissionManual,
            observations: row.observations,
            source: row.source,
            createdById: row.created_by_id ?? row.createdById,
            createdByName: row.created_by_name ?? row.createdByName,
            createdByRole: row.created_by_role ?? row.createdByRole,
            createdIp: row.created_ip ?? row.createdIp,
            asaas: deepNormalizeKeys(row.asaas),
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
        }));

        // 6. Config
        await migrateTable('config', prisma.config, (row) => ({
            key: row.key,
            value: deepNormalizeKeys(row.value)
        }), 'key');

        // 7. Audit Logs
        await migrateTable('audit_logs', prisma.auditLog, (row) => ({
            id: row.id,
            timestamp: row.timestamp,
            userId: row.user_id ?? row.userId,
            userName: row.user_name ?? row.userName,
            userRole: row.user_role ?? row.userRole,
            action: row.action,
            details: row.details
        }));

        // 8. Customer Trash
        await migrateTable('customers_trash', prisma.customerTrash, (row) => ({
            id: row.id,
            cpf: row.cpf,
            data: deepNormalizeKeys(row.data),
            deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
        }));

        console.log('\n🎉 Migration Complete!');
    } catch (e: any) {
        console.error('\n❌ Migration Failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();

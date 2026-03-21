
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function columnExists(tableName, columnName) {
  const result = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
      AND column_name = ${columnName}
  `;
  // @ts-ignore
  return result[0].count > 0 || result[0].COUNT > 0;
}

async function main() {
  try {
    console.log('Checking if temporary_orders_data table exists...');
    
    // Check if table exists (MySQL specific)
    const result = await prisma.$queryRaw`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'temporary_orders_data'
    `;
    
    // @ts-ignore
    const exists = result[0].count > 0 || result[0].COUNT > 0;

    if (!exists) {
        console.log('Table does not exist. Creating...');
        await prisma.$executeRaw`
            CREATE TABLE temporary_orders_data (
                id VARCHAR(191) NOT NULL,
                data JSON NOT NULL,
                created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                deleted_at DATETIME(3) NULL,
                rejected_at DATETIME(3) NULL,
                rejected_by_id VARCHAR(191) NULL,
                rejected_by_name VARCHAR(191) NULL,
                rejected_by_role VARCHAR(191) NULL,
                reject_reason TEXT NULL,
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        console.log('Table temporary_orders_data created successfully.');
    } else {
        console.log('Table temporary_orders_data already exists.');
        const columnsToEnsure = [
          { name: 'deleted_at', ddl: 'ALTER TABLE temporary_orders_data ADD COLUMN deleted_at DATETIME(3) NULL' },
          { name: 'rejected_at', ddl: 'ALTER TABLE temporary_orders_data ADD COLUMN rejected_at DATETIME(3) NULL' },
          { name: 'rejected_by_id', ddl: 'ALTER TABLE temporary_orders_data ADD COLUMN rejected_by_id VARCHAR(191) NULL' },
          { name: 'rejected_by_name', ddl: 'ALTER TABLE temporary_orders_data ADD COLUMN rejected_by_name VARCHAR(191) NULL' },
          { name: 'rejected_by_role', ddl: 'ALTER TABLE temporary_orders_data ADD COLUMN rejected_by_role VARCHAR(191) NULL' },
          { name: 'reject_reason', ddl: 'ALTER TABLE temporary_orders_data ADD COLUMN reject_reason TEXT NULL' },
        ];

        for (const col of columnsToEnsure) {
          const existsCol = await columnExists('temporary_orders_data', col.name);
          if (!existsCol) {
            console.log(`Adding column ${col.name}...`);
            await prisma.$executeRawUnsafe(col.ddl);
            console.log(`Column ${col.name} added.`);
          }
        }
    }

  } catch (e) {
    console.error('Error running migration:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

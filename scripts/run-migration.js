
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
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

    console.log('Checking if price_changes table exists...');
    const priceChangesExists = await prisma.$queryRaw`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'price_changes'
    `;
    // @ts-ignore
    if (!(priceChangesExists[0].count > 0 || priceChangesExists[0].COUNT > 0)) {
        console.log('Table price_changes does not exist. Creating...');
        await prisma.$executeRaw`
            CREATE TABLE price_changes (
                id VARCHAR(191) NOT NULL,
                product_id VARCHAR(191) NOT NULL,
                product_name VARCHAR(191) NOT NULL,
                old_price DOUBLE NOT NULL,
                new_price DOUBLE NOT NULL,
                user_id VARCHAR(191) NULL,
                user_name VARCHAR(191) NULL,
                created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        console.log('Table price_changes created successfully.');
    } else {
        console.log('Table price_changes already exists.');
    }

    // person_folders
    console.log('Checking if person_folders table exists...');
    const personFoldersExists = await prisma.$queryRaw`
      SELECT count(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = 'person_folders'
    `;
    // @ts-ignore
    if (!(personFoldersExists[0].count > 0 || personFoldersExists[0].COUNT > 0)) {
      console.log('Table person_folders does not exist. Creating...');
      await prisma.$executeRaw`
        CREATE TABLE person_folders (
          id VARCHAR(191) NOT NULL,
          name VARCHAR(191) NOT NULL,
          observations TEXT NULL,
          created_by_id VARCHAR(191) NULL,
          created_by_name VARCHAR(191) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX person_folders_name_idx (name)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;
      console.log('Table person_folders created successfully.');
    } else {
      console.log('Table person_folders already exists.');
    }

    // folder_files
    console.log('Checking if folder_files table exists...');
    const folderFilesExists = await prisma.$queryRaw`
      SELECT count(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = 'folder_files'
    `;
    // @ts-ignore
    if (!(folderFilesExists[0].count > 0 || folderFilesExists[0].COUNT > 0)) {
      console.log('Table folder_files does not exist. Creating...');
      await prisma.$executeRaw`
        CREATE TABLE folder_files (
          id VARCHAR(191) NOT NULL,
          folder_id VARCHAR(191) NOT NULL,
          name VARCHAR(191) NOT NULL,
          file_type VARCHAR(191) NOT NULL,
          mime_type VARCHAR(191) NULL,
          size INT NULL,
          data_url LONGTEXT NOT NULL,
          observations TEXT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX folder_files_folder_id_idx (folder_id),
          CONSTRAINT folder_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES person_folders (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;
      console.log('Table folder_files created successfully.');
    } else {
      console.log('Table folder_files already exists. Checking columns...');
      const hasObservations = await columnExists('folder_files', 'observations');
      if (!hasObservations) {
        console.log('Adding column observations to folder_files...');
        await prisma.$executeRawUnsafe('ALTER TABLE folder_files ADD COLUMN observations TEXT NULL');
        console.log('Column observations added.');
      }
    }

    // Hash plain text passwords
    console.log('Hashing plain text passwords...');
    const allUsers = await prisma.user.findMany({ select: { id: true, username: true, password: true } });
    let hashed = 0;
    for (const u of allUsers) {
      if (u.password && !u.password.startsWith('$2')) {
        const hash = await bcrypt.hash(u.password, 10);
        await prisma.user.update({ where: { id: u.id }, data: { password: hash } });
        console.log(`  Password hashed for user: ${u.username}`);
        hashed++;
      }
    }
    if (hashed === 0) {
      console.log('  All passwords already hashed. Nothing to do.');
    } else {
      console.log(`  ${hashed} password(s) hashed successfully.`);
    }

  } catch (e) {
    console.error('Error running migration:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

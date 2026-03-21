
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if table exists (MySQL specific)
    const result: any[] = await db.$queryRaw`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'temporary_orders_data'
    `;
    
    // Check for both possible return structures (uppercase or lowercase key)
    const count = result[0]?.count || result[0]?.COUNT || 0;
    const exists = Number(count) > 0;

    if (!exists) {
        await db.$executeRaw`
            CREATE TABLE temporary_orders_data (
                id VARCHAR(191) NOT NULL,
                data JSON NOT NULL,
                created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        return NextResponse.json({ success: true, message: 'Table temporary_orders_data created successfully.' });
    } else {
        return NextResponse.json({ success: true, message: 'Table temporary_orders_data already exists.' });
    }

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import FreightPaymentsTable from '@/components/FreightPaymentsTable';
import { saveFreightAction, setFreightPaidAction } from '@/app/actions/admin/freight';
import { requireFreightAccess, listFreights, freightError } from '@/lib/freight-server';

export const dynamic = 'force-dynamic';

export default async function FreightPage() {
  try {
    const user = await requireFreightAccess();
    const rows = await listFreights();
    return <FreightPaymentsTable currentUserId={user.id} initialRows={rows} saveAction={saveFreightAction} paymentAction={setFreightPaidAction} />;
  } catch (error) {
    return <div className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Pagamentos de frete</h1><p role="alert" className="mt-3 text-muted-foreground">{freightError(error).error}</p></div>;
  }
}

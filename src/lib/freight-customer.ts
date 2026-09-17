export type FreightCustomerOption = {
  id: string;
  code: string | null;
  name: string;
  zip: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
};

export type FreightCustomerSearchResult =
  | { success: true; customers: FreightCustomerOption[] }
  | { success: false; error: string };

export function freightCustomerFields(customer: FreightCustomerOption) {
  return {
    zipCode: customer.zip ?? '',
    address: [customer.address, customer.number].filter(value => value?.trim()).join(', '),
    complement: customer.complement ?? '',
    neighborhood: customer.neighborhood ?? '',
  };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { freightCustomerFields, type FreightCustomerOption, type FreightCustomerSearchResult } from '@/lib/freight-customer';

type Props = {
  defaultValue?: string;
  readOnly: boolean;
  searchAction: (query: string) => Promise<FreightCustomerSearchResult>;
  onCustomerSelected: () => void;
};

export default function FreightCustomerName({ defaultValue = '', readOnly, searchAction, onCustomerSelected }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);
  const [customers, setCustomers] = useState<FreightCustomerOption[]>([]);
  const [message, setMessage] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const expanded = focused && touched && !readOnly && value.trim().length >= 2;

  useEffect(() => {
    let cancelled = false;
    setCustomers([]);
    setActiveIndex(-1);
    setMessage('');
    if (!expanded) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const result = await searchAction(value.trim());
        if (cancelled) return;
        if (result.success) {
          setCustomers(result.customers);
          if (!result.customers.length) setMessage('Nenhum cliente encontrado. Você pode usar o nome digitado.');
        } else setMessage('Não foi possível buscar clientes. Você pode preencher os dados manualmente.');
      } catch {
        if (!cancelled) setMessage('Não foi possível buscar clientes. Você pode preencher os dados manualmente.');
      } finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value, expanded, searchAction]);

  function selectCustomer(customer: FreightCustomerOption) {
    onCustomerSelected();
    const form = input.current?.form;
    if (form) {
      for (const [name, fieldValue] of Object.entries(freightCustomerFields(customer))) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement && !field.readOnly) field.value = fieldValue;
      }
    }
    setValue(customer.name);
    setTouched(false);
    setCustomers([]);
    setActiveIndex(-1);
    input.current?.focus();
  }

  return <div className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }}>
    <Label htmlFor="freight-recipient-query">Nome</Label>
    <Input ref={input} id="freight-recipient-query" name="freightRecipientQuery" type="search" role="combobox" aria-autocomplete="list"
      aria-expanded={expanded} aria-controls={expanded ? 'freight-customer-options' : undefined}
      aria-activedescendant={expanded && activeIndex >= 0 ? `freight-customer-option-${activeIndex}` : undefined}
      aria-describedby="freight-name-help" autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} required minLength={2} maxLength={160}
      readOnly={readOnly} value={value} placeholder="Digite o nome para buscar um cliente"
      onFocus={() => setFocused(true)}
      onChange={event => { setValue(event.target.value); setTouched(true); setCustomers([]); setActiveIndex(-1); }}
      onKeyDown={event => {
        if (!expanded) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setTouched(false); }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && customers.length) {
          event.preventDefault();
          setActiveIndex(index => event.key === 'ArrowDown' ? (index + 1) % customers.length : (index <= 0 ? customers.length - 1 : index - 1));
        }
        if (event.key === 'Enter' && activeIndex >= 0 && customers[activeIndex]) {
          event.preventDefault(); selectCustomer(customers[activeIndex]);
        }
      }} />
    <p id="freight-name-help" className="mt-1 text-xs text-muted-foreground">Busque um cliente cadastrado ou digite um nome livremente.</p>
    {expanded && <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
      <div id="freight-customer-options" role="listbox" aria-label="Clientes encontrados" aria-busy={searching}>
        {customers.map((customer, index) => <button key={customer.id} id={`freight-customer-option-${index}`} type="button" role="option"
          aria-selected={index === activeIndex} tabIndex={-1}
          className={`block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent ${index === activeIndex ? 'bg-accent' : ''}`}
          onMouseDown={event => event.preventDefault()} onClick={() => selectCustomer(customer)}>
          <span className="block font-medium">{customer.name}{customer.code ? ` · ${customer.code}` : ''}</span>
          <span className="block text-xs text-muted-foreground">{[customer.address, customer.number, customer.neighborhood].filter(Boolean).join(' · ') || 'Endereço não cadastrado'}</span>
        </button>)}
      </div>
      {(searching || message) && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">{searching ? 'Buscando clientes…' : message}</p>}
    </div>}
  </div>;
}

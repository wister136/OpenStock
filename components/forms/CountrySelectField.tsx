'use client';

import React, { useMemo, useState } from 'react';
import type { Control, FieldError, FieldValues, Path } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import countryList from 'react-select-country-list';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

type CountrySelectFieldProps<TFieldValues extends FieldValues = FieldValues> = {
  name: Path<TFieldValues>;
  label: string;
  control: Control<TFieldValues>;
  error?: FieldError;
  required?: boolean;
  placeholder?: string;
};

function getFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function CountryPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const countries = useMemo(() => countryList().getData(), []);

  const selected = value ? countries.find((c) => c.value === value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="country-select-trigger">
          {selected ? (
            <span className="flex items-center gap-2">
              <span>{getFlagEmoji(selected.value)}</span>
              <span>{selected.label}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0 bg-gray-800 border-gray-600" align="start">
        <Command className="bg-gray-800 border-gray-600">
          <CommandInput
            placeholder={t('country.searchPlaceholder')}
            className="country-select-input"
          />
          <CommandEmpty className="country-select-empty">
            {t('country.noResults')}
          </CommandEmpty>

          <div className="max-h-60 overflow-auto bg-gray-800 scrollbar-hide-default">
            <CommandGroup className="bg-gray-800">
              {countries.map((country) => (
                <CommandItem
                  key={country.value}
                  value={`${country.label} ${country.value}`}
                  onSelect={() => {
                    onChange(country.value);
                    setOpen(false);
                  }}
                  className="country-select-item"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 text-teal-500',
                      value === country.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="flex items-center gap-2">
                    <span>{getFlagEmoji(country.value)}</span>
                    <span>{country.label}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function CountrySelectField<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  control,
  error,
  required = false,
  placeholder,
}: CountrySelectFieldProps<TFieldValues>) {
  const { t } = useI18n();

  const resolvedPlaceholder = placeholder ?? t('country.selectPlaceholder');

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="form-label">
        {label}
      </Label>

      <Controller
        name={name}
        control={control}
        rules={{
          required: required ? t('country.required') : false,
        }}
        render={({ field }) => (
          <CountryPicker
            value={(field.value as string) ?? ''}
            onChange={field.onChange}
            placeholder={resolvedPlaceholder}
          />
        )}
      />

      {error?.message ? <p className="text-sm text-red-500">{error.message}</p> : null}

      <p className="text-xs text-gray-500">{t('country.helper')}</p>
    </div>
  );
}

'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import SelectField from '@/components/forms/SelectField';
import CountrySelectField from '@/components/forms/CountrySelectField';
import OpenDevSocietyBranding from '@/components/OpenDevSocietyBranding';

import { signUpWithEmail } from '@/lib/actions/auth.actions';
import { INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS } from '@/lib/constants';
import { useI18n } from '@/lib/i18n';

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  country: string;
  investmentGoals: string;
  riskTolerance: string;
  preferredIndustry: string;
};

export default function SignUp() {
  const router = useRouter();
  const { t } = useI18n();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onBlur' });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await signUpWithEmail(values);
      if (!result?.success) {
        toast.error('Sign up failed', { description: result?.error ?? '' });
        return;
      }
      router.push('/');
    } catch (e) {
      toast.error('Sign up failed', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const goals = INVESTMENT_GOALS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const risks = RISK_TOLERANCE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const industries = PREFERRED_INDUSTRIES.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <h1 className="text-2xl font-semibold text-gray-100">{t('auth.startJourney')}</h1>

        <InputField
          name="fullName"
          label={t('auth.fullName')}
          placeholder={t('auth.fullNamePlaceholder')}
          register={register}
          error={errors.fullName}
          validation={{ required: t('auth.fullNameRequired') }}
        />

        <InputField
          name="email"
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          type="email"
          register={register}
          error={errors.email}
          validation={{
            required: t('auth.emailRequired'),
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: t('auth.emailInvalid'),
            },
          }}
        />

        <InputField
          name="password"
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          type="password"
          register={register}
          error={errors.password}
          validation={{
            required: t('auth.passwordRequired'),
            minLength: { value: 8, message: t('auth.passwordMin') },
          }}
        />

        <CountrySelectField
          name="country"
          label={t('auth.country')}
          placeholder={t('auth.countryPlaceholder')}
          control={control}
          error={errors.country}
          required
        />

        <SelectField
          name="investmentGoals"
          label={t('auth.investmentGoal')}
          placeholder={t('auth.investmentGoalPlaceholder')}
          options={goals}
          control={control}
          error={errors.investmentGoals}
          required
        />

        <SelectField
          name="riskTolerance"
          label={t('auth.riskTolerance')}
          placeholder={t('auth.riskTolerancePlaceholder')}
          options={risks}
          control={control}
          error={errors.riskTolerance}
          required
        />

        <SelectField
          name="preferredIndustry"
          label={t('auth.preferredIndustry')}
          placeholder={t('auth.preferredIndustryPlaceholder')}
          options={industries}
          control={control}
          error={errors.preferredIndustry}
          required
        />

        <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
          {isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')}
        </Button>

        <FooterLink text={t('auth.haveAccount')} linkText={t('auth.signInLink')} href="/sign-in" />
        <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
      </form>
    </>
  );
}

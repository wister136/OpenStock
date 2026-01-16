'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import OpenDevSocietyBranding from '@/components/OpenDevSocietyBranding';
import { signInWithEmail } from '@/lib/actions/auth.actions';
import { useI18n } from '@/lib/i18n';

type FormValues = {
  email: string;
  password: string;
};

export default function SignIn() {
  const router = useRouter();
  const { t } = useI18n();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onBlur' });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await signInWithEmail(values.email, values.password);
      if (!result?.success) {
        toast.error(t('auth.signInFailed'), { description: result?.error ?? '' });
        return;
      }
      router.push('/');
    } catch (e) {
      toast.error(t('auth.signInFailed'), {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

        <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
          {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>

        <FooterLink
          text={t('auth.noAccount')}
          linkText={t('auth.signUpLink')}
          href="/sign-up"
        />

        <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
      </form>
    </>
  );
}

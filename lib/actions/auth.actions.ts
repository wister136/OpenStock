'use server';

import { auth } from '@/lib/better-auth/auth';
import { inngest } from '@/lib/inngest/client';
import { headers } from 'next/headers';

export const signUpWithEmail = async ({
  email,
  password,
  fullName,
  country,
  investmentGoals,
  riskTolerance,
  preferredIndustry,
}: SignUpFormData) => {
  try {
    const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } });

    if (response) {
      const disabled = process.env.DISABLE_INNGEST === '1';
      const eventKey = process.env.INNGEST_EVENT_KEY;

      // ✅ 本地默认：没 key 或显式禁用就跳过，避免 401
      if (disabled || !eventKey) {
        console.log('ℹ️ Inngest skipped (disabled or INNGEST_EVENT_KEY not set).');
      } else {
        try {
          console.log('📤 Sending Inngest event: app/user.created for', email);
          await inngest.send({
            name: 'app/user.created',
            data: {
              email,
              name: fullName,
              country,
              investmentGoals,
              riskTolerance,
              preferredIndustry,
            },
          });
          console.log('✅ Inngest event sent successfully');
        } catch (error) {
          // 不要把 error 对象直接 console.error（会刷堆栈），输出 message 就够了
          const msg = error instanceof Error ? error.message : String(error);
          console.warn('⚠️ Inngest send failed (ignored):', msg);
        }
      }
    }

    return { success: true, data: response };
  } catch (e) {
    console.log('Sign up failed', e);
    return { success: false, error: 'Sign up failed' };
  }
};

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
  try {
    const response = await auth.api.signInEmail({ body: { email, password } });
    return { success: true, data: response };
  } catch (e) {
    console.log('Sign in failed', e);
    return { success: false, error: 'Sign in failed' };
  }
};

export const signOut = async () => {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (e) {
    console.log('Sign out failed', e);
    return { success: false, error: 'Sign out failed' };
  }
};

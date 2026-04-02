import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserById } from '$lib/server/db';
import { checkBudget } from '$lib/server/token-limiter';

export const load: PageServerLoad = async ({ cookies }) => {
  const selectedUserId = cookies.get('selected_user');
  if (!selectedUserId) {
    throw redirect(302, '/');
  }

  const user = await getUserById(selectedUserId);
  if (!user) {
    cookies.delete('selected_user', { path: '/' });
    throw redirect(302, '/');
  }

  const budget = await checkBudget(selectedUserId);
  return {
    selectedUserId,
    budget: {
      allowed: budget.allowed,
      remaining: Math.max(0, budget.dailyLimit - budget.dailyUsed),
      limit: budget.dailyLimit,
      reason: budget.reason,
    },
  };
};

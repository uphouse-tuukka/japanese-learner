import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const selectedUserId = cookies.get('selected_user');
  if (!selectedUserId) throw redirect(302, '/');
  return { selectedUserId };
};

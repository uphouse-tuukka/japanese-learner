import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserById } from '$lib/server/db';

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

  return { selectedUserId };
};

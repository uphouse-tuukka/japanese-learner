import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUser } from '$lib/server/users';

function readSelectedUserId(cookies: { get(name: string): string | undefined }): string | null {
return cookies.get('selected_user') ?? cookies.get('selected_user_id') ?? cookies.get('user_id') ?? null;
}

export const load: PageServerLoad = async ({ cookies }) => {
const selectedUserId = readSelectedUserId(cookies);
if (!selectedUserId) {
throw redirect(303, '/');
}

const user = await getUser(selectedUserId);
if (!user) {
cookies.delete('selected_user', { path: '/' });
cookies.delete('selected_user_id', { path: '/' });
throw redirect(303, '/');
}

return { user };
};

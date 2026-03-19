import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getHistoryByUser } from '$lib/server/db';

export const load: PageServerLoad = async ({ cookies }) => {
const selectedUserId = cookies.get('selected_user');
if (!selectedUserId) {
throw redirect(302, '/');
}

const history = await getHistoryByUser(selectedUserId);
return {
selectedUserId,
history
};
};

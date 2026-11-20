import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import WorkspaceClient from '../../workspace-client';
import { productDestination } from '../../../../lib/product-destination';
import { createHandler } from '../../../../lib/beta/server';

export default async function PrivatePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const query = await searchParams;
  const login = '/login?next=' + encodeURIComponent(productDestination('/app' + (query.org ? '?org=' + encodeURIComponent(query.org) : '')));
  const jar=await cookies();
  const origin=process.env.BETA_ORIGIN;
  if(!origin || !jar.has('unify_session')) redirect(login);
  const response=await createHandler()(new Request(origin+'/api/session',{headers:{cookie:jar.toString()}}));
  // Login renews an expired session through a same-origin POST before showing records.
  if(!response.ok) redirect(login);
  return <WorkspaceClient/>;
}

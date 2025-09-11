import UnlockForm from './UnlockForm';

type SP = { next?: string };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const next = typeof sp?.next === 'string' ? sp.next : '/';
  return <UnlockForm next={next} />;
}

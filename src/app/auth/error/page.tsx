export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-destructive text-sm">
        Authentication failed{reason ? `: ${reason}` : ''}
      </p>
      <a href="/login" className="text-primary text-sm underline underline-offset-4">
        Back to sign in
      </a>
    </div>
  );
}

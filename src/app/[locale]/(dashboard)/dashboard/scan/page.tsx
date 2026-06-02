'use client';
import { useRouter } from '@/i18n/navigation';
import { ScannerView } from '@/components/scanner/scanner-view';

// Scanner goes full-screen over the app shell.
// The router.back() / push returns to the previous dashboard page.
export default function ScanPage() {
  const router = useRouter();
  return <ScannerView onClose={() => router.push('/dashboard')} />;
}

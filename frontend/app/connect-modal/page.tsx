import { Suspense } from 'react';
import ConnectModalClient from './ConnectModalClient';

export default function ConnectModalPage() {
  return (
    <Suspense fallback={null}>
      <ConnectModalClient />
    </Suspense>
  );
}

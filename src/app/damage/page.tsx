'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 火力計算ページは廃止されました。
 * ビルドページの「結果」タブに統合されています。
 */
export default function DamagePage() {
  const router = useRouter();

  useEffect(() => {
    // ビルドページの結果タブにリダイレクト
    router.replace('/build');
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400">リダイレクト中...</p>
        <p className="text-sm text-gray-500 mt-2">
          火力計算はビルドページの「結果」タブに統合されました
        </p>
      </div>
    </main>
  );
}

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UseApplyResultParams {
  selectedJobName: string | null;
  spAllocation: Record<string, number>;
}

// EXタイプのマッピング（optimize結果 → buildStore形式）
const EX_TYPE_MAPPING: Record<string, string> = {
  Power: 'power',
  Magic: 'magic',
  HP: 'hp',
  Mind: 'mind',
  Agility: 'speed',
  Speed: 'speed',
  Dex: 'dex',
  Dexterity: 'dex',
  CritDamage: 'critDamage',
  Defense: 'defense',
};

/**
 * 最適化結果をビルドに適用するカスタムフック
 */
export function useApplyResult({
  selectedJobName,
  spAllocation,
}: UseApplyResultParams) {
  const router = useRouter();

  const handleApplyResult = useCallback(
    (result: any) => {
      if (!result?.equipmentSet) {
        console.warn('No equipment set found in result');
        return;
      }

      // sessionStorageに最適化結果を保存（ビルドページ初期化後に適用するため）
      const pendingData = {
        jobName: selectedJobName,
        spAllocation: spAllocation,
        emblem: result.selectedEmblem
          ? {
              name:
                result.selectedEmblem.アイテム名 || result.selectedEmblem.name,
            }
          : null,
        runestones:
          result.selectedRunestones?.runestones?.map(
            (r: { name: string }) => ({
              name: r.name,
            })
          ) || [],
        equipmentSet: Object.fromEntries(
          Object.entries(result.equipmentSet).map(([slot, detail]) => {
            if (!detail || !(detail as any).equipment) {
              return [slot, null];
            }
            const equipment = { ...(detail as any).equipment };
            const stats = (detail as any).stats;
            const config = (detail as any).configuration;

            // EX設定を装備に追加（防具・アクセサリーの場合）
            if (stats && (stats._ex1Type || stats._ex2Type)) {
              equipment.exStats = {
                ex1: stats._ex1Type
                  ? EX_TYPE_MAPPING[stats._ex1Type] ||
                    stats._ex1Type.toLowerCase()
                  : null,
                ex2: stats._ex2Type
                  ? EX_TYPE_MAPPING[stats._ex2Type] ||
                    stats._ex2Type.toLowerCase()
                  : null,
              };
            }

            // 叩き回数を装備に追加
            if (config?.smithing) {
              equipment.smithingCounts = config.smithing;
              equipment.enhancementLevel = config.enhancement || 0;
              equipment.rank = config.rank || 'SSS';
              equipment.alchemyEnabled = config.alchemyEnabled || false;
            }

            return [slot, equipment];
          })
        ),
      };

      sessionStorage.setItem(
        'pendingOptimizeResult',
        JSON.stringify(pendingData)
      );

      // ビルドページへ遷移
      router.push('/build');
    },
    [selectedJobName, spAllocation, router]
  );

  return { handleApplyResult };
}

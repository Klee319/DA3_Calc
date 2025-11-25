'use client';

import { useEffect, useState } from 'react';
import { useBuildStore, UserOption, RingOption, Food } from '@/store/buildStore';
import { initializeGameData } from '@/lib/data';
import { JobSelector } from '@/components/JobSelector';
import { LevelInput } from '@/components/LevelInput';
import { SPSlider } from '@/components/SPSlider';
import { EquipmentSlot } from '@/components/EquipmentSlot';
import { StatViewer } from '@/components/StatViewer';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';
import { EquipSlot, Job, Equipment } from '@/types';
import { FoodData } from '@/types/data';

export default function BuildPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const {
    currentBuild,
    calculatedStats,
    availableJobs,
    availableEquipment,
    availableFoods,
    userOption,
    ringOption,
    selectedFood,
    foodEnabled,
    weaponSkillEnabled,
    setJob,
    setLevel,
    setEquipment,
    setSPAllocation,
    setUserOption,
    setRingOption,
    setFood,
    toggleFood,
    toggleWeaponSkill,
    setAvailableJobs,
    setAvailableEquipment,
    setAvailableFoods,
    setGameData,
  } = useBuildStore();

  // データ初期化
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const gameData = await initializeGameData();
        
        // ゲームデータをストアに設定
        // JobSPDataの型変換が必要なため、現在は空配列を設定
        // 実際の変換は後で実装
        setGameData({
          eqConst: gameData.yaml.eqConst,
          jobConst: gameData.yaml.jobConst,
          jobSPData: undefined, // 一旦未定義にして、後で適切な変換を実装
        });

        // 職業データの変換
        const jobs: Job[] = Array.from(gameData.csv.jobs.entries()).map(([name, spData]) => ({
          id: name,
          name: name,
          baseStats: {
            HP: 100,
            MP: 50,
            ATK: 10,
            DEF: 10,
            MATK: 10,
            MDEF: 10,
            AGI: 10,
            DEX: 10,
            LUK: 10,
            CRI: 5,
            HIT: 95,
            FLEE: 10,
          },
          statGrowth: {
            HP: 10,
            MP: 5,
            ATK: 2,
            DEF: 2,
            MATK: 2,
            MDEF: 2,
            AGI: 1,
            DEX: 1,
            LUK: 1,
            CRI: 0,
            HIT: 0,
            FLEE: 0,
          },
          availableWeapons: ['sword', 'staff', 'bow', 'dagger', 'axe'] as any[],
          skills: [],
          maxLevel: 100,
        }));

        // 装備データの変換
        const equipments: Equipment[] = [
          ...gameData.csv.weapons.map(w => ({
            id: w.アイテム名,
            name: w.アイテム名,
            slot: 'weapon' as EquipSlot,
            baseStats: [
              { stat: 'ATK' as const, value: w['攻撃力（初期値）'] || 0, isPercent: false },
              { stat: 'CRI' as const, value: w['会心率（初期値）'] || 0, isPercent: false },
            ],
            requiredLevel: w.使用可能Lv || 1,
            requiredJob: [],
            rarity: w.最低ランク || 'common',
          })),
          ...gameData.csv.armors.map(a => {
            const slotMap: { [key: string]: EquipSlot } = {
              '頭': 'head',
              '胴': 'body',
              '腕': 'arm',
              '脚': 'leg',
            };
            return {
              id: a.アイテム名,
              name: a.アイテム名,
              slot: 'body' as EquipSlot,
              baseStats: [
                { stat: 'DEF' as const, value: a['守備力（初期値）'] || 0, isPercent: false },
                { stat: 'HP' as const, value: a['HP（初期値）'] || 0, isPercent: false },
              ],
              requiredLevel: a.使用可能Lv || 1,
              requiredJob: [],
              rarity: a.最低ランク || 'common',
            };
          }),
          ...gameData.csv.accessories.map(a => ({
            id: a.アイテム名,
            name: a.アイテム名,
            slot: 'accessory1' as EquipSlot,
            baseStats: [
              {
                stat: (a.ステータス種類 === 'HP' ? 'HP' :
                       a.ステータス種類 === 'MP' ? 'MP' :
                       a.ステータス種類 === '攻撃力' ? 'ATK' :
                       a.ステータス種類 === '守備力' ? 'DEF' : 'ATK') as any,
                value: a['ステータス値（初期値）'] || 0,
                isPercent: false
              },
            ],
            requiredLevel: a.使用可能Lv || 1,
            requiredJob: [],
            rarity: a.最低ランク || 'common',
          })),
        ];

        // 食べ物データの変換
        const foods: Food[] = gameData.csv.foods.map(f => ({
          id: f.アイテム名,
          name: f.アイテム名,
          effects: [
            ...(f.効果1 && f.数値1 ? [{
              stat: (f.効果1 === 'HP' ? 'HP' :
                     f.効果1 === 'MP' ? 'MP' :
                     f.効果1 === '攻撃力' ? 'ATK' :
                     f.効果1 === '防御力' ? 'DEF' :
                     f.効果1 === '魔法攻撃力' ? 'MATK' :
                     f.効果1 === '魔法防御力' ? 'MDEF' : 'ATK') as any,
              value: f.数値1,
              isPercent: f.効果1.includes('%'),
            }] : []),
            ...(f.効果2 && f.数値2 ? [{
              stat: (f.効果2 === 'HP' ? 'HP' :
                     f.効果2 === 'MP' ? 'MP' :
                     f.効果2 === '攻撃力' ? 'ATK' :
                     f.効果2 === '防御力' ? 'DEF' :
                     f.効果2 === '魔法攻撃力' ? 'MATK' :
                     f.効果2 === '魔法防御力' ? 'MDEF' : 'ATK') as any,
              value: f.数値2,
              isPercent: f.効果2.includes('%'),
            }] : []),
          ],
          duration: f.持続時間 || 30,
        }));

        setAvailableJobs(jobs);
        setAvailableEquipment(equipments);
        setAvailableFoods(foods);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load game data:', error);
        setIsLoading(false);
      }
    };

    loadGameData();
  }, [setAvailableJobs, setAvailableEquipment, setAvailableFoods, setGameData]);

  if (isLoading) {
    return (
      <main className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600 dark:text-gray-400">データを読み込み中...</p>
        </div>
      </main>
    );
  }

  // 装備スロットの定義
  const equipmentSlots: Array<{ slot: EquipSlot; name: string }> = [
    { slot: 'weapon', name: '武器' },
    { slot: 'head', name: '頭' },
    { slot: 'body', name: '胴' },
    { slot: 'arm', name: '腕' },
    { slot: 'leg', name: '脚' },
    { slot: 'accessory1', name: 'ネックレス' },
    { slot: 'accessory2', name: 'ブレスレット' },
  ];

  // 職業に応じた装備可能フィルタ
  const getFilteredEquipment = (slot: EquipSlot): Equipment[] => {
    return availableEquipment.filter(eq => {
      if (eq.slot !== slot) return false;
      if (eq.requiredLevel && currentBuild.level < eq.requiredLevel) return false;
      if (currentBuild.job && eq.requiredJob && eq.requiredJob.length > 0) {
        return eq.requiredJob.includes(currentBuild.job.id);
      }
      return true;
    });
  };

  // 食べ物アイコンを取得
  const getFoodIcon = (foodName: string): string => {
    const lowerName = foodName.toLowerCase();
    if (lowerName.includes('肉') || lowerName.includes('ステーキ')) return '🍖';
    if (lowerName.includes('魚')) return '🐟';
    if (lowerName.includes('パン') || lowerName.includes('bread')) return '🍞';
    if (lowerName.includes('野菜') || lowerName.includes('サラダ')) return '🥗';
    if (lowerName.includes('スープ')) return '🍲';
    if (lowerName.includes('酒') || lowerName.includes('ワイン')) return '🍷';
    if (lowerName.includes('ポーション')) return '🧪';
    if (lowerName.includes('果物') || lowerName.includes('フルーツ')) return '🍎';
    if (lowerName.includes('甘') || lowerName.includes('デザート')) return '🍰';
    return '🍽️';
  };

  return (
    <main className="container mx-auto px-4 max-w-7xl">
      {/* ページヘッダー */}
      <div className="mb-12">
        <h1 className="text-5xl md:text-6xl font-thin mb-4 text-gradient from-white to-gray-300">
          キャラクタービルド
        </h1>
        <p className="text-lg text-gray-400 line-clamp-2">
          職業・装備・SPを設定して、最強のキャラクターを構築しよう
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左カラム（2列分） */}
        <div className="lg:col-span-2 space-y-6">
          {/* 職業・レベルセクション */}
          <div className="glass-card p-8 min-h-[200px]">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">👤</span>
              <span className="truncate">職業・レベル</span>
            </h2>
            <div className="space-y-4">
              <JobSelector
                jobs={availableJobs}
                selectedJob={currentBuild.job}
                onChange={setJob}
              />
              {currentBuild.job && (
                <LevelInput
                  level={currentBuild.level}
                  onChange={setLevel}
                  maxLevel={currentBuild.job.maxLevel}
                />
              )}
            </div>
          </div>

          {/* SP割り振りセクション */}
          {currentBuild.job && (
            <div className="glass-card p-8 min-h-[300px]">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                <span className="truncate">SP割り振り</span>
              </h2>
              <SPSlider
                spValues={{
                  A: currentBuild.spAllocation?.A || 0,
                  B: currentBuild.spAllocation?.B || 0,
                  C: currentBuild.spAllocation?.C || 0,
                }}
                maxSP={100}
                onChange={(values) => setSPAllocation(values)}
              />
            </div>
          )}

          {/* 装備セクション */}
          <div className="glass-card p-8 min-h-[600px]">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">⚔️</span>
              <span className="truncate">装備</span>
            </h2>
            <div className="space-y-3">
              {equipmentSlots.map(({ slot, name }) => (
                <EquipmentSlot
                  key={slot}
                  slot={slot}
                  equipment={currentBuild.equipment[slot] || null}
                  availableEquipment={getFilteredEquipment(slot)}
                  onEquipmentChange={(equipment) => setEquipment(slot, equipment)}
                  disabled={!currentBuild.job}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 右カラム（1列分） */}
        <div className="space-y-6">
          {/* バフセクション */}
          <div className="glass-card p-8 min-h-[400px]">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">✨</span>
              <span className="truncate">バフ効果</span>
            </h2>

            {/* リングバフ */}
            <div className="mb-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ringOption.enabled}
                  onChange={(e) => setRingOption({ ...ringOption, enabled: e.target.checked })}
                  className="checkbox-primary mr-3"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">リングバフ</span>
              </label>
              {ringOption.enabled && (
                <div className="mt-3 ml-6 p-4 glass-card-secondary rounded-lg animate-fadeIn">
                  <CustomSelect
                    options={[
                      { value: 'attack_1', label: '攻撃リング Lv1', icon: '⚔️', description: '攻撃力 +10%' },
                      { value: 'magic_1', label: '魔法リング Lv1', icon: '🔮', description: '魔法攻撃力 +10%' },
                      { value: 'defense_1', label: '防御リング Lv1', icon: '🛡️', description: '防御力 +10%' },
                    ]}
                    value={ringOption.rings.length > 0 ? `${ringOption.rings[0].type}_${ringOption.rings[0].level}` : ''}
                    onChange={(value) => {
                      const [type, level] = value.split('_');
                      setRingOption({ 
                        ...ringOption, 
                        rings: [{
                          type: type as 'attack' | 'magic' | 'defense',
                          level: parseInt(level) || 1
                        }]
                      });
                    }}
                    placeholder="リングを選択"
                    label="リング設定"
                  />
                </div>
              )}
            </div>

            {/* 食べ物バフ */}
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={foodEnabled}
                  onChange={(e) => toggleFood(e.target.checked)}
                  className="checkbox-primary mr-3"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">食べ物バフ</span>
              </label>
              {foodEnabled && (
                <div className="mt-3 ml-6 p-4 glass-card-secondary rounded-lg animate-fadeIn">
                  <CustomSelect
                    options={[
                      { value: '', label: '選択してください', icon: '🍽️' },
                      ...availableFoods.map(food => ({
                        value: food.id,
                        label: food.name,
                        icon: getFoodIcon(food.name),
                        description: food.effects.map(e => 
                          `${e.stat} +${e.value}${e.isPercent ? '%' : ''}`
                        ).join(', ')
                      }))
                    ]}
                    value={selectedFood?.id || ''}
                    onChange={(value) => {
                      const food = availableFoods.find(f => f.id === value);
                      setFood(food || null);
                    }}
                    placeholder="食べ物を選択"
                    label="食べ物選択"
                  />
                  {selectedFood && (
                    <div className="mt-2 text-xs text-gray-400">
                      持続時間: {selectedFood.duration}分
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 高度な設定 */}
          <div className="glass-card p-8 min-h-[200px]">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="flex items-center justify-between w-full text-left mb-4"
            >
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <span className="text-3xl">⚙️</span>
                <span className="truncate">高度な設定</span>
              </h2>
              <span className="text-gray-400 text-2xl transition-transform duration-200" style={{
                transform: showAdvancedSettings ? 'rotate(90deg)' : 'rotate(0deg)'
              }}>
                ▶
              </span>
            </button>

            {showAdvancedSettings && (
              <div className="space-y-6 animate-fadeIn">
                {/* 武器固有能力 */}
                <div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={weaponSkillEnabled}
                      onChange={(e) => toggleWeaponSkill(e.target.checked)}
                      className="checkbox-primary mr-3"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">武器固有能力</span>
                  </label>
                </div>

                {/* 手動ステータス調整 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    手動ステータス調整
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(['ATK', 'MATK', 'DEF', 'MDEF', 'HP', 'MP'] as const).map(stat => (
                      <div key={stat} className="flex items-center">
                        <label className="text-sm text-gray-600 dark:text-gray-400 w-16">
                          {stat}:
                        </label>
                        <input
                          type="number"
                          className="input-secondary w-24"
                          value={userOption.manualStats[stat] || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setUserOption({
                              ...userOption,
                              manualStats: {
                                ...userOption.manualStats,
                                [stat]: value,
                              },
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 最終ステータス表示 */}
          <div className="glass-card p-8 sticky top-24 min-h-[500px] max-h-[800px] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">📈</span>
              <span className="truncate">最終ステータス</span>
            </h2>
            <StatViewer
              stats={calculatedStats}
              showBreakdown={true}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
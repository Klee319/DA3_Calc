import * as mathjs from 'mathjs';
import {
  CalcResult,
  CalcError,
  DamageCalcInput,
  DamageResult,
  EnemyParams,
  DamageCalcOptions,
  WeaponType,
  StatBlock
} from '@/types/calc';
import {
  WeaponCalcData,
  SkillCalcData
} from '@/types/data';
import { loadWeaponCalc, loadSkillCalc } from '@/lib/data/yamlLoader';

/**
 * ダメージ計算のメイン関数
 * 基礎ダメージ → 職業補正 → 会心 → スキル倍率 → 最終ダメージの順で計算
 */
export function calculateDamage(
  input: DamageCalcInput,
  weaponCalc: WeaponCalcData,
  skillCalc?: SkillCalcData
): CalcResult<DamageResult> {
  try {
    // 基礎ダメージ計算
    const baseDamage = calculateBaseDamage(
      input.weaponType,
      input.weaponAttackPower,
      input.weaponCritRate,
      input.weaponCritDamage,
      input.damageCorrection,
      input.userStats.final,
      weaponCalc,
      input.options.damageCorrectionMode
    );

    // 職業補正の適用
    let correctedDamage = baseDamage;
    if (input.jobName) {
      correctedDamage = applyJobCorrection(
        baseDamage,
        input.jobName,
        input.weaponType,
        input.userStats.final,
        weaponCalc
      );
    }

    // 会心ダメージの適用
    const critModeMap: Record<string, 'crit' | 'nocrit' | 'avg'> = {
      'always': 'crit',
      'never': 'nocrit',
      'expected': 'avg'
    };
    const critMode = critModeMap[input.options.critMode] || 'avg';
    
    const critResult = applyCritDamage(
      correctedDamage,
      input.weaponCritRate,
      input.weaponCritDamage,
      critMode
    );

    // スキルダメージ計算（スキルが指定されている場合）
    let skillMultiplier = 1;
    let hits = 1;
    let mp = 0;
    let ct = 0;

    if (input.options.skillName && skillCalc) {
      const skillResult = calculateSkillDamage(
        input.options.skillName,
        critResult, // critResultは数値
        input.userStats.final,
        input.weaponType,
        skillCalc,
        weaponCalc
      );
      
      if (skillResult.success && skillResult.data) {
        skillMultiplier = skillResult.data.damage / critResult;
        hits = skillResult.data.hits;
        mp = skillResult.data.mp;
        ct = skillResult.data.ct;
      }
    }

    // 1ヒットダメージ
    const hitDamage = critResult * skillMultiplier;

    // 総ダメージ（多段ヒット考慮）
    const totalDamage = hitDamage * hits;

    // 最終ダメージ（敵防御・耐性適用）
    const finalDamage = calculateFinalDamage(totalDamage, input.enemy.defense || 0);

    // 結果の構築
    const result: DamageResult = {
      baseDamage: baseDamage,
      critMultiplier: critResult / correctedDamage, // 倍率を計算
      skillMultiplier: skillMultiplier,
      hits: hits,
      hitDamage: hitDamage,
      totalDamage: totalDamage,
      finalDamage: finalDamage,
      mp: mp,
      ct: ct
    };

    // DPS計算（クールタイムがある場合）
    if (ct > 0) {
      result.dps = finalDamage / ct;
    }

    // TTK計算（敵HPがある場合）
    if (input.enemy.hp && input.enemy.hp > 0) {
      result.ttk = Math.ceil(input.enemy.hp / finalDamage);
    }

    // MP効率計算（MPがある場合）
    if (mp > 0) {
      result.mpEfficiency = finalDamage / mp;
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DAMAGE_CALC_ERROR',
        message: `ダメージ計算中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * 基礎ダメージ計算
 * 武器種別ごとの計算式を適用
 */
export function calculateBaseDamage(
  weaponType: WeaponType,
  weaponAttackPower: number,
  weaponCritRate: number,
  weaponCritDamage: number,
  damageCorrection: number,
  userStats: StatBlock,
  weaponCalc: WeaponCalcData,
  damageCorrectionMode: 'min' | 'max' | 'avg'
): number {
  // 武器種別を正規化（小文字に変換、最初を大文字に）
  const normalizedType = weaponType.toLowerCase();
  const formulaKey = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
  
  // 武器種別に対応する計算式を取得
  const baseDamageFormula = weaponCalc.BasedDamage?.[formulaKey];
  if (!baseDamageFormula) {
    throw new Error(`武器種別 '${weaponType}' の計算式が見つかりません`);
  }
  
  // ダメージ補正の実際の値を計算
  const actualDamageCorrection = damageCorrectionMode === 'min' ? 0.8 
                               : damageCorrectionMode === 'max' ? 1.2
                               : 1.0; // avg
  
  // 計算式の変数を準備
  const variables: Record<string, number> = {
    WeaponAttackPower: weaponAttackPower,
    WeaponCritRate: weaponCritRate,
    WeaponCritDamage: weaponCritDamage,
    DamageCorrection: actualDamageCorrection,
    UserPower: (userStats as any).Power || (userStats as any).ATK || 0,
    UserMagic: (userStats as any).Magic || (userStats as any).MATK || 0,
    UserMind: (userStats as any).Mind || (userStats as any).MDEF || 0,
    UserAgility: (userStats as any).Agility || (userStats as any).AGI || 0,
    UserHP: (userStats as any).HP || 0,
    UserDex: (userStats as any).Dexterity || (userStats as any).Dex || (userStats as any).DEX || 0,
    UserDefense: (userStats as any).Defense || (userStats as any).DEF || 0,
    UserCritDamage: (userStats as any).CriticalDamage || (userStats as any).CritDamage || 0,
    ComboCorrection: 1 // フライパンのコンボ補正（現時点では1として扱う）
  };
  
  // 計算式の評価
  const result = evaluateFormulaString(baseDamageFormula, variables);
  
  return Math.floor(result);
}

/**
 * 職業補正の適用
 */
export function applyJobCorrection(
  baseDamage: number,
  jobName: string,
  weaponType: WeaponType,
  userStats: StatBlock,
  weaponCalc: WeaponCalcData
): number {
  // 職業補正の取得
  const jobCorrectionFormula = weaponCalc.JobCorrection?.[jobName]?.[weaponType];
  
  if (!jobCorrectionFormula) {
    // 職業補正がない場合は基礎ダメージをそのまま返す
    return baseDamage;
  }
  
  // 計算式の変数を準備
  const variables: Record<string, number> = {
    BasedDamage: baseDamage,
    UserPower: (userStats as any).Power || (userStats as any).ATK || 0,
    UserMagic: (userStats as any).Magic || (userStats as any).MATK || 0,
    UserMind: (userStats as any).Mind || (userStats as any).MDEF || 0,
    UserAgility: (userStats as any).Agility || (userStats as any).AGI || 0,
    UserHP: (userStats as any).HP || 0,
    UserDex: (userStats as any).Dexterity || (userStats as any).Dex || (userStats as any).DEX || 0,
    UserDefense: (userStats as any).Defense || (userStats as any).DEF || 0,
    UserCritDamage: (userStats as any).CriticalDamage || (userStats as any).CritDamage || 0,
  };
  
  // 計算式の評価
  const result = evaluateFormulaString(jobCorrectionFormula, variables);
  
  return Math.floor(result);
}

/**
 * スキルダメージ計算
 */
export function calculateSkillDamage(
  skillId: string,
  baseDamage: number,
  userStats: StatBlock,
  weaponType: WeaponType,
  skillCalc: SkillCalcData,
  weaponCalc?: WeaponCalcData
): CalcResult<{damage: number; hits: number; mp: number; ct: number}> {
  try {
    const skillDefinition = (skillCalc.Skills as any)?.[skillId];
    
    if (!skillDefinition) {
      return {
        success: false,
        error: {
          code: 'SKILL_NOT_FOUND',
          message: `スキル '${skillId}' が見つかりません`
        }
      };
    }
    
    // 計算用のコンテキストを作成
    const context: Record<string, number> = {
      UserPower: (userStats as any).Power || (userStats as any).ATK || 0,
      UserMagic: (userStats as any).Magic || (userStats as any).MATK || 0,
      UserMind: (userStats as any).Mind || (userStats as any).MDEF || 0,
      UserAgility: (userStats as any).Agility || (userStats as any).AGI || 0,
      UserHP: (userStats as any).HP || 0,
      UserDex: (userStats as any).Dexterity || (userStats as any).Dex || (userStats as any).DEX || 0,
      UserDefense: (userStats as any).Defense || (userStats as any).DEF || 0,
      Power: (userStats as any).Power || (userStats as any).ATK || 0,
      Magic: (userStats as any).Magic || (userStats as any).MATK || 0,
      Mind: (userStats as any).Mind || (userStats as any).MDEF || 0,
      HP: (userStats as any).HP || 0
    };

    // MP消費量の計算
    let mp = 0;
    if (skillDefinition.MP) {
      if (typeof skillDefinition.MP === 'string') {
        mp = evaluateFormulaString(skillDefinition.MP, context);
      } else if (typeof skillDefinition.MP === 'number') {
        mp = skillDefinition.MP;
      }
    }

    // クールタイムの計算
    let ct = 0;
    if (skillDefinition.CT) {
      if (typeof skillDefinition.CT === 'string') {
        ct = evaluateFormulaString(skillDefinition.CT, context);
      } else if (typeof skillDefinition.CT === 'number') {
        ct = skillDefinition.CT;
      }
    }

    // ダメージ倍率の計算
    let damage = baseDamage;
    if (skillDefinition.Damage) {
      if (typeof skillDefinition.Damage === 'string') {
        // BaseDamage.Sword のような参照を処理
        let damageFormula = skillDefinition.Damage as string;
        if (damageFormula.includes('BaseDamage.')) {
          // 特定の武器種の基礎ダメージを参照
          const weaponMatch = damageFormula.match(/BaseDamage\.(\w+)/);
          if (weaponMatch) {
            const weaponTypeForCalc = weaponMatch[1];
            const baseDamageFormulaKey = weaponCalc?.BasedDamage?.[weaponTypeForCalc];
            if (baseDamageFormulaKey) {
              // その武器種の基礎ダメージを計算
              const weaponBaseDamage = evaluateFormulaString(baseDamageFormulaKey, context);
              damageFormula = damageFormula.replace(`BaseDamage.${weaponTypeForCalc}`, weaponBaseDamage.toString());
            }
          }
        } else if (damageFormula.includes('BaseDamage')) {
          // 現在の武器種の基礎ダメージを使用
          damageFormula = damageFormula.replace('BaseDamage', baseDamage.toString());
        }
        
        damage = evaluateFormulaString(damageFormula, context);
      }
    }

    // ヒット数の計算
    const hits = parseHits(skillDefinition.Hits || 1, 'avg');

    return {
      success: true,
      data: {
        damage: damage,
        hits: hits,
        mp: mp,
        ct: ct
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SKILL_CALC_ERROR',
        message: `スキル計算中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * 会心ダメージの適用
 */
export function applyCritDamage(
  damage: number,
  critRate: number,
  critDamage: number,
  critMode: 'crit' | 'nocrit' | 'avg'
): number {
  if (critMode === 'crit') {
    return Math.floor(damage * (1 + critDamage / 100));
  } else if (critMode === 'nocrit') {
    return damage;
  } else {
    // 平均値計算
    const critDamageValue = Math.floor(damage * (1 + critDamage / 100));
    return Math.floor(damage * (1 - critRate / 100) + critDamageValue * (critRate / 100));
  }
}

/**
 * ダメージ補正の適用
 */
export function applyDamageCorrection(
  damage: number,
  correctionMode: 'min' | 'max' | 'avg'
): number {
  const minCorrection = 0.8;
  const maxCorrection = 1.2;
  
  if (correctionMode === 'min') {
    return Math.floor(damage * minCorrection);
  } else if (correctionMode === 'max') {
    return Math.floor(damage * maxCorrection);
  } else {
    // 平均値
    return damage;
  }
}

/**
 * 最終ダメージの計算
 */
export function calculateFinalDamage(
  damage: number,
  enemyDefense: number
): number {
  // 簡易的な防御計算
  const defenseMitigation = Math.max(0, 1 - enemyDefense / 1000);
  return Math.floor(damage * defenseMitigation);
}

/**
 * 計算式文字列の評価
 */
export function evaluateFormulaString(
  formula: string,
  context: Record<string, number>
): number {
  try {
    // 変数名を置換
    let evaluableFormula = formula;
    
    // <Level> などのパラメータを置換
    evaluableFormula = evaluableFormula.replace(/<Level>/g, (context.SkillLevel || context.Level || 1).toString());
    evaluableFormula = evaluableFormula.replace(/<AgilityFactor>/g, (context.Agility || 0).toString());
    evaluableFormula = evaluableFormula.replace(/<PowerFactor>/g, (context.Power || 0).toString());
    evaluableFormula = evaluableFormula.replace(/<MagicFactor>/g, (context.Magic || 0).toString());
    
    // 変数名を実際の値に置換
    Object.entries(context).forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      evaluableFormula = evaluableFormula.replace(regex, value.toString());
    });

    // mathjsで評価
    const result = mathjs.evaluate(evaluableFormula);
    
    if (typeof result === 'number') {
      return result;
    } else {
      return Number(result);
    }
  } catch (error) {
    console.error('Formula evaluation error:', error, formula);
    throw new Error(`計算式の評価に失敗しました: ${formula}`);
  }
}

/**
 * ヒット数の解析
 */
export function parseHits(
  hitsValue: string | number,
  mode: 'min' | 'max' | 'avg' = 'avg'
): number {
  if (typeof hitsValue === 'number') {
    return hitsValue;
  }

  // "5~6" のような範囲指定を解析
  const rangeMatch = hitsValue.match(/(\d+)~(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    
    switch (mode) {
      case 'min':
        return min;
      case 'max':
        return max;
      case 'avg':
        return (min + max) / 2;
      default:
        return min;
    }
  }

  // 単純な数値文字列
  const parsed = parseInt(hitsValue, 10);
  return isNaN(parsed) ? 1 : parsed;
}

/**
 * スキル定義を探索
 */
function findSkillDefinition(
  skillName: string,
  skillCalc: SkillCalcData
): any {
  if (!skillCalc.SkillDefinition) {
    return null;
  }

  const skillDef = skillCalc.SkillDefinition as Record<string, any>;

  // SkillBook内を探索
  if (skillDef.SkillBook) {
    for (const weaponType of Object.keys(skillDef.SkillBook)) {
      const weaponSkills = skillDef.SkillBook[weaponType];
      if (weaponSkills[skillName]) {
        return weaponSkills[skillName];
      }
    }
  }

  // JobSkill内を探索
  if (skillDef.JobSkill) {
    for (const jobName of Object.keys(skillDef.JobSkill)) {
      const jobSkills = skillDef.JobSkill[jobName];
      if (jobSkills[skillName]) {
        return jobSkills[skillName];
      }
    }
  }

  return null;
}
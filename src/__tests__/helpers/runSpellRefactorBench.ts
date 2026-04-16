import { loadFullGameData } from './loadGameData';
import { optimizeEquipment, OptimizeGameData } from '@/lib/calc/optimize/engine';
import { CharacterBuild } from '@/types';
import { OptimizeConstraints } from '@/types/optimize';
import { EnemyParams } from '@/types/calc';

export interface BenchResult {
  topDamage: number;
  topOriginal: number;
  topStats: Record<string, any>;
  elapsedMs: number;
  rank1EquipNames: Record<string, string>;
  meetsMinimum: boolean;
  warnings?: string[];
  resultsCount: number;
  emblem?: string | null;
  runestones?: string[];
}

export interface BenchOptions {
  beamWidth?: number;
  enableRunestoneSearch?: boolean;
  enableTarotSearch?: boolean;
}

export async function runSpellRefactorSwordBench(
  opts: BenchOptions = {}
): Promise<BenchResult> {
  const game = await loadFullGameData();

  const optimizeData: OptimizeGameData = {
    weapons: game.csv.weapons,
    armors: game.csv.armors,
    accessories: game.csv.accessories,
    eqConst: game.yaml.eqConst,
    emblems: game.csv.emblems,
    jobConst: game.yaml.jobConst,
    jobSPData: game.csv.jobs,
    weaponCalc: game.yaml.weaponCalc,
    skillCalc: game.yaml.skillCalc,
    runestones: game.csv.runestones,
    tarots: game.csv.tarots,
    tarotCalcData: game.yaml.tarotCalc,
  };

  const jobName = 'SpellRefactor';
  const jobNameJP = 'スペルリファクター';
  const jobMaxLevel = 180;

  const build: CharacterBuild = {
    id: 'bench',
    name: 'bench',
    job: { id: jobName, name: jobName, nameJP: jobNameJP, grade: 'Third' } as any,
    level: jobMaxLevel,
    spAllocation: { A: 0, B: 0, C: 0 } as any,
    equipment: {
      weapon: null,
      head: null,
      body: null,
      leg: null,
      accessory1: null,
      accessory2: null,
    } as any,
    buffs: [],
  } as CharacterBuild;

  const constraints: OptimizeConstraints = {
    maxResults: 10,
    targetSlots: ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'],
  } as any;

  const enemy: EnemyParams = {
    defense: 0,
    typeResistance: 0,
    attributeResistance: 0,
  };

  const startTime = Date.now();
  const quiet = process.env.SR_QUIET === '1';
  let lastPhase = '';
  let lastBest = 0;
  let lastLogMs = 0;
  const result = await optimizeEquipment(
    build,
    ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'],
    constraints,
    '通常攻撃',
    enemy,
    optimizeData,
    (p) => {
      if (quiet) return;
      const now = Date.now();
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      const bestChanged = p.currentBest && Math.abs(p.currentBest - lastBest) > 30;
      const phaseChanged = p.phase !== lastPhase;
      const heartbeat = now - lastLogMs > 2000;
      if (phaseChanged || bestChanged || heartbeat) {
        lastPhase = p.phase;
        lastBest = p.currentBest || 0;
        lastLogMs = now;
        const best = p.currentBest ? Math.round(p.currentBest) : '-';
        const line = `[${elapsed}s ${p.phase} ${p.percentage}%] best=${best} ${p.message || ''}`;
        process.stdout.write(line + '\n');
        try {
          const fs = require('fs');
          const path = require('path');
          const logPath = process.env.SR_LIVE_LOG || path.join(process.cwd(), 'bench_live.log');
          fs.appendFileSync(logPath, line + '\n');
        } catch {}
      }
    },
    {
      mode: 'damage',
      selectedWeaponType: 'Sword',
      availableWeaponTypes: ['Sword', 'Wand'],
      availableArmorTypes: ['布', '革', '金属'],
      jobName,
      jobNameJP,
      jobMaxLevel,
      spAllocation: {},
      enableRunestoneSearch: opts.enableRunestoneSearch !== false,
      enableTarotSearch: opts.enableTarotSearch !== false,
      beamWidth: opts.beamWidth,
    }
  );
  const elapsedMs = Date.now() - startTime;

  const top = result.results[0];
  const equipNames: Record<string, string> = {};
  if (top?.equipment) {
    for (const slot of ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2']) {
      const eq = (top.equipment as any)[slot];
      if (eq) equipNames[slot] = eq.name;
    }
  }

  return {
    topDamage: top?.expectedDamage ?? 0,
    topOriginal: top?.damageDetails?.baseDamage ?? 0,
    topStats: top?.calculatedStats ?? {},
    elapsedMs,
    rank1EquipNames: equipNames,
    meetsMinimum: !!top?.meetsMinimum,
    warnings: result.warnings,
    resultsCount: result.results.length,
    emblem: top?.selectedEmblem?.['アイテム名'] ?? null,
    runestones: top?.selectedRunestones?.runestones?.map((r: any) => r.name) ?? [],
  };
}

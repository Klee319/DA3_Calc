import { loadFullGameData } from './loadGameData';
import { optimizeEquipment, OptimizeGameData } from '@/lib/calc/optimize/engine';
import { CharacterBuild } from '@/types';
import { OptimizeConstraints } from '@/types/optimize';
import { EnemyParams } from '@/types/calc';

export interface JobBenchResult {
  topDamage: number;
  topStats: Record<string, any>;
  elapsedMs: number;
  rank1EquipNames: Record<string, string>;
  meetsMinimum: boolean;
  warnings?: string[];
  resultsCount: number;
  emblem: string | null;
  runestones: string[];
}

export interface JobBenchConfig {
  jobName: string;
  jobNameJP: string;
  jobGrade?: string;
  jobMaxLevel?: number;
  selectedWeaponType: string;
  availableWeaponTypes: string[];
  availableArmorTypes?: string[];
  skillId: string;
  beamWidth?: number;
  enableRunestoneSearch?: boolean;
  enableTarotSearch?: boolean;
  quiet?: boolean;
  label?: string;
}

export async function runJobBench(cfg: JobBenchConfig): Promise<JobBenchResult> {
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

  const jobMaxLevel = cfg.jobMaxLevel ?? 180;
  const build: CharacterBuild = {
    id: 'bench',
    name: 'bench',
    job: { id: cfg.jobName, name: cfg.jobName, nameJP: cfg.jobNameJP, grade: cfg.jobGrade ?? 'Third' } as any,
    level: jobMaxLevel,
    spAllocation: { A: 0, B: 0, C: 0 } as any,
    equipment: {
      weapon: null, head: null, body: null, leg: null,
      accessory1: null, accessory2: null,
    } as any,
    buffs: [],
  } as CharacterBuild;

  const constraints: OptimizeConstraints = {
    maxResults: 10,
    targetSlots: ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'],
  } as any;

  const enemy: EnemyParams = { defense: 0, typeResistance: 0, attributeResistance: 0 };

  const startTime = Date.now();
  const quiet = cfg.quiet !== false;
  let lastPhase = '';
  let lastBest = 0;
  let lastLogMs = 0;
  const tag = cfg.label || cfg.jobName;

  const result = await optimizeEquipment(
    build,
    ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'],
    constraints,
    cfg.skillId,
    enemy,
    optimizeData,
    (p) => {
      if (quiet) return;
      const now = Date.now();
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      const bestChanged = p.currentBest && Math.abs(p.currentBest - lastBest) > 30;
      const phaseChanged = p.phase !== lastPhase;
      const heartbeat = now - lastLogMs > 3000;
      if (phaseChanged || bestChanged || heartbeat) {
        lastPhase = p.phase;
        lastBest = p.currentBest || 0;
        lastLogMs = now;
        const best = p.currentBest ? Math.round(p.currentBest) : '-';
        process.stdout.write(`  [${tag} ${elapsed}s ${p.phase} ${p.percentage}%] best=${best}\n`);
      }
    },
    {
      mode: 'damage',
      selectedWeaponType: cfg.selectedWeaponType,
      availableWeaponTypes: cfg.availableWeaponTypes,
      availableArmorTypes: cfg.availableArmorTypes ?? ['布', '革', '金属'],
      jobName: cfg.jobName,
      jobNameJP: cfg.jobNameJP,
      jobMaxLevel,
      spAllocation: {},
      enableRunestoneSearch: cfg.enableRunestoneSearch !== false,
      enableTarotSearch: cfg.enableTarotSearch !== false,
      beamWidth: cfg.beamWidth,
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

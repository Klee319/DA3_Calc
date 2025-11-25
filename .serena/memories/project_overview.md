# DA_calc Project Overview

## Purpose
DA_calc is a web application for Dragon Age (DA) game calculations, specifically for equipment, job, and skill calculations.

## Tech Stack
- **Framework**: Next.js 14.2 with App Router
- **Language**: TypeScript
- **UI Framework**: React 18.3
- **CSS**: Tailwind CSS
- **State Management**: Zustand 4.5
- **Math Library**: MathJS 13.0
- **YAML Parser**: js-yaml 4.1.0

## Project Structure
```
DA_calc/
├── data/
│   ├── csv/
│   │   ├── Equipment/
│   │   │   ├── DA_EqCalc_Data - アクセサリー .csv
│   │   │   ├── DA_EqCalc_Data - ルーンストーン.csv
│   │   │   ├── DA_EqCalc_Data - 武器.csv
│   │   │   ├── DA_EqCalc_Data - 防具.csv
│   │   │   ├── DA_EqCalc_Data - 食べ物.csv
│   │   │   └── DA_EqCalc_Data - 紋章.csv
│   │   └── Job/
│   │       ├── ガーディアン.csv
│   │       ├── ステラシャフト.csv
│   │       ├── スペルリファクター.csv
│   │       ├── ノービス.csv
│   │       └── プリースト.csv
│   └── formula/
│       ├── EqConst.yaml
│       ├── JobConst.yaml
│       ├── SkillCalc.yaml
│       ├── UserStatusCalc.yaml
│       └── WeaponCalc.yaml
├── src/
│   ├── app/          # Next.js App Router pages
│   ├── components/   # React components
│   ├── lib/          # Library utilities
│   ├── store/        # Zustand stores
│   └── types/        # TypeScript type definitions
└── ref/              # Reference documents

## Notes
- TypeScript with strict mode enabled
- Path alias configured: @/* -> ./src/*
- Windows environment
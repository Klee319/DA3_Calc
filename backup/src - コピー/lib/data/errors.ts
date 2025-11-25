/**
 * データローダー関連のエラークラス
 */

/**
 * データ読み込みエラーの基底クラス
 */
export class DataLoadError extends Error {
  constructor(
    message: string,
    public readonly fileName: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'DataLoadError';
  }
}

/**
 * YAMLパースエラー
 */
export class YamlParseError extends DataLoadError {
  constructor(
    fileName: string,
    originalError?: Error
  ) {
    super(
      `Failed to parse YAML file: ${fileName}`,
      fileName,
      originalError
    );
    this.name = 'YamlParseError';
  }
}

/**
 * CSVパースエラー
 */
export class CsvParseError extends DataLoadError {
  constructor(
    fileName: string,
    public readonly line?: number,
    originalError?: Error
  ) {
    const message = line 
      ? `Failed to parse CSV file: ${fileName} at line ${line}`
      : `Failed to parse CSV file: ${fileName}`;
    super(message, fileName, originalError);
    this.name = 'CsvParseError';
  }
}

/**
 * ファイルが見つからないエラー
 */
export class FileNotFoundError extends DataLoadError {
  constructor(fileName: string) {
    super(`File not found: ${fileName}`, fileName);
    this.name = 'FileNotFoundError';
  }
}

/**
 * データ検証エラー
 */
export class DataValidationError extends Error {
  constructor(
    message: string,
    public readonly dataType: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DataValidationError';
  }
}

/**
 * エラーハンドリング用ユーティリティ
 */
export class DataLoadErrorHandler {
  private static errors: DataLoadError[] = [];

  /**
   * エラーを記録
   */
  static addError(error: DataLoadError): void {
    this.errors.push(error);
    console.error(`[${error.name}] ${error.message}`, error.originalError);
  }

  /**
   * 記録されたエラーを取得
   */
  static getErrors(): DataLoadError[] {
    return [...this.errors];
  }

  /**
   * エラーをクリア
   */
  static clearErrors(): void {
    this.errors = [];
  }

  /**
   * エラーがあるかチェック
   */
  static hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * エラーサマリーを生成
   */
  static getErrorSummary(): string {
    if (this.errors.length === 0) {
      return 'No errors';
    }

    const summary = this.errors.map(err => {
      return `- ${err.name}: ${err.message}`;
    }).join('\n');

    return `Data loading errors (${this.errors.length}):\n${summary}`;
  }
}

/**
 * フォールバック値を提供するヘルパー関数
 */
export function withFallback<T>(
  loader: () => Promise<T>,
  fallback: T,
  errorMessage?: string
): Promise<T> {
  return loader().catch(error => {
    if (errorMessage) {
      console.warn(errorMessage, error);
    }
    return fallback;
  });
}
'use client';

import { BuildPreset } from '@/store/buildStore';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant: 'primary' | 'danger' | 'warning';
  onConfirm: () => void;
}

interface PresetPanelProps {
  showPresetPanel: boolean;
  setShowPresetPanel: (show: boolean) => void;
  presetName: string;
  setPresetName: (name: string) => void;
  presets: BuildPreset[];
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  updatePreset: (id: string, name?: string) => void;
  editingPresetId: string | null;
  setEditingPresetId: (id: string | null) => void;
  editingPresetName: string;
  setEditingPresetName: (name: string) => void;
  setConfirmDialog: (dialog: ConfirmDialogState | ((prev: ConfirmDialogState) => ConfirmDialogState)) => void;
}

export function PresetPanel({
  showPresetPanel,
  setShowPresetPanel,
  presetName,
  setPresetName,
  presets,
  savePreset,
  loadPreset,
  deletePreset,
  updatePreset,
  editingPresetId,
  setEditingPresetId,
  editingPresetName,
  setEditingPresetName,
  setConfirmDialog,
}: PresetPanelProps) {
  if (!showPresetPanel) return null;

  return (
    <div className="mb-8 bg-gray-800 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">ビルドプリセット</h2>
        <button
          onClick={() => setShowPresetPanel(false)}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 新規プリセット保存 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="プリセット名を入力..."
          className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => {
            if (presetName.trim()) {
              savePreset(presetName.trim());
              setPresetName('');
            }
          }}
          disabled={!presetName.trim()}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>保存</span>
        </button>
      </div>

      {/* プリセット一覧 */}
      {presets.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p>保存されたプリセットはありません</p>
          <p className="text-sm mt-1">現在のビルドを保存してみましょう</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors gap-3"
            >
              <div className="flex-1 min-w-0">
                {editingPresetId === preset.id ? (
                  <input
                    type="text"
                    value={editingPresetName}
                    onChange={(e) => setEditingPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updatePreset(preset.id, editingPresetName);
                        setEditingPresetId(null);
                      } else if (e.key === 'Escape') {
                        setEditingPresetId(null);
                      }
                    }}
                    className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <>
                    <h3 className="font-medium text-white truncate">{preset.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {preset.build.job?.name || '未設定'} Lv.{preset.build.level}
                      <span className="hidden sm:inline"> - </span>
                      <span className="block sm:inline">
                        {new Date(preset.updatedAt).toLocaleString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0">
                {editingPresetId === preset.id ? (
                  <>
                    <button
                      onClick={() => {
                        updatePreset(preset.id, editingPresetName);
                        setEditingPresetId(null);
                      }}
                      className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-600 rounded"
                      title="保存"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingPresetId(null)}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded"
                      title="キャンセル"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'プリセットの読み込み',
                          message: `プリセット「${preset.name}」を読み込みます。現在のビルドは上書きされます。よろしいですか？`,
                          confirmText: '読み込む',
                          confirmVariant: 'primary',
                          onConfirm: () => {
                            loadPreset(preset.id);
                            setShowPresetPanel(false);
                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                          },
                        });
                      }}
                      className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-600 rounded"
                      title="読み込み"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'プリセットの上書き',
                          message: `プリセット「${preset.name}」を現在のビルドで上書きします。よろしいですか？`,
                          confirmText: '上書き',
                          confirmVariant: 'warning',
                          onConfirm: () => {
                            updatePreset(preset.id);
                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                          },
                        });
                      }}
                      className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-gray-600 rounded"
                      title="現在のビルドで上書き"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setEditingPresetId(preset.id);
                        setEditingPresetName(preset.name);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded"
                      title="名前変更"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'プリセットの削除',
                          message: `プリセット「${preset.name}」を削除します。この操作は元に戻せません。よろしいですか？`,
                          confirmText: '削除',
                          confirmVariant: 'danger',
                          onConfirm: () => {
                            deletePreset(preset.id);
                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                          },
                        });
                      }}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-600 rounded"
                      title="削除"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

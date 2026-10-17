import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { backupRepository } from '@/data';
import {
  checkBackupImages,
  parseLearningBackup,
  type BackupPreview,
  type LearningBackup,
} from '@/data/backup-repository';

type PendingImport = {
  backup: LearningBackup;
  preview: BackupPreview;
  name: string;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试。';
}

export function BackupPage() {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportFile() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const backup = await backupRepository.exportBackup();
      const blob = new Blob([JSON.stringify(backup)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kaogong-learning-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice('备份文件已准备下载。请将文件保存在只有你能访问的位置。');
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function selectFile(file?: File) {
    setPending(null);
    setNotice(null);
    setError(null);
    if (!file) return;
    setBusy(true);
    try {
      const backup = parseLearningBackup(
        JSON.parse(await file.text()) as unknown,
      );
      await checkBackupImages(backup);
      const preview = await backupRepository.previewImport(backup);
      setPending({ backup, preview, name: file.name });
    } catch (reason) {
      setError(`无法恢复此文件：${message(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await checkBackupImages(pending.backup);
      await backupRepository.importBackup(pending.backup);
      setPending(null);
      setNotice('恢复完成，正在重新读取学习记录…');
      window.location.reload();
    } catch (reason) {
      setError(`恢复失败，本地记录未更改：${message(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-[22px] pt-7 pb-8">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 text-xs text-primary"
      >
        <ArrowLeft size={15} /> 返回首页
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">备份与恢复</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        学习记录保存在当前浏览器。定期下载备份文件，以便清除站点数据后恢复。
      </p>

      <section
        className="mt-8 border-t border-border pt-5"
        aria-labelledby="export-title"
      >
        <h2 id="export-title" className="text-base font-semibold">
          下载备份
        </h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          包含进度、练习、作答、错题和历史内容版本；不包含整套题库及图片。
        </p>
        <Button
          className="mt-4 min-h-11"
          onClick={() => void exportFile()}
          disabled={busy}
        >
          <Download /> 下载学习记录
        </Button>
      </section>

      <section
        className="mt-8 border-t border-border pt-5"
        aria-labelledby="restore-title"
      >
        <h2 id="restore-title" className="text-base font-semibold">
          从文件恢复
        </h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          先检查文件与历史图片，再预览新增记录。恢复会合并数据，不会清空本机记录。
        </p>
        <Button variant="outline" className="mt-4 min-h-11" asChild>
          <label htmlFor="backup-file" className="cursor-pointer">
            <Upload /> 选择备份文件
          </label>
        </Button>
        <input
          id="backup-file"
          className="sr-only"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            void selectFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        {pending && (
          <div
            className="mt-5 rounded-md border border-border p-4 text-sm"
            aria-live="polite"
          >
            <p className="font-medium wrap-anywhere">{pending.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              导出时间：
              {new Date(pending.backup.exportedAt).toLocaleString('zh-CN')}
            </p>
            <ul className="mt-3 space-y-1 text-xs leading-5">
              <li>新增练习：{pending.preview.sessions}</li>
              <li>新增作答：{pending.preview.answers}</li>
              <li>更新课程进度：{pending.preview.lessonProgress}</li>
              <li>更新错题状态：{pending.preview.mistakes}</li>
              <li>补齐历史内容版本：{pending.preview.contentVersions}</li>
            </ul>
            <Button
              className="mt-4 min-h-11"
              disabled={busy}
              onClick={() => void restore()}
            >
              确认恢复
            </Button>
          </div>
        )}
      </section>
      {busy && (
        <p role="status" className="mt-5 text-sm">
          正在检查学习记录…
        </p>
      )}
      {notice && (
        <p role="status" className="mt-5 text-sm text-primary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="mt-8 text-xs leading-5 text-muted-foreground">
        文件未加密，可能包含私人题目内容与学习历史。请仅在自己的设备上保存和使用。
      </p>
    </div>
  );
}

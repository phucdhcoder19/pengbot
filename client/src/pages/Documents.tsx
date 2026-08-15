import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { PageHeader } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { DocumentIcon, TrashIcon, UploadIcon } from "../components/ui/icons";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import * as api from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate, formatFileSize, formatNumber } from "../lib/format";
import type { Document } from "../lib/types";

const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];
const MAX_SIZE = 10 * 1024 * 1024;

/** Kiểm ở client trước khi gửi — người dùng biết ngay, không phải chờ mạng. */
function rejectReason(file: File): string | null {
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!ACCEPTED.includes(ext)) {
    return `${file.name}: only PDF, Word (.docx), .txt and .md are accepted.`;
  }
  if (file.size > MAX_SIZE) {
    return `${file.name}: is ${formatFileSize(file.size)}, over the 10 MB limit.`;
  }
  if (file.size === 0) {
    return `${file.name}: file is empty.`;
  }
  return null;
}

export function DocumentsPage() {
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api.listDocuments(), []);
  const { data, error, loading, reload } = useAsync(load);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [target, setTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Còn tài liệu đang xử lý thì hỏi lại server mỗi 3 giây, xong thì tự dừng.
  const inFlight = data?.some(
    (d) => d.status === "PENDING" || d.status === "PROCESSING",
  );

  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => void reload({ quiet: true }), 3_000);
    return () => clearInterval(timer);
  }, [inFlight, reload]);

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const problems = files
        .map(rejectReason)
        .filter((r): r is string => r !== null);
      const accepted = files.filter((f) => rejectReason(f) === null);
      setRejected(problems);
      if (!accepted.length) return;

      setUploading(true);
      try {
        for (const file of accepted) {
          await api.uploadDocument(file);
        }
        show(
          accepted.length === 1
            ? `Uploaded "${accepted[0].name}". The bot is reading it.`
            : `Uploaded ${accepted.length} documents. The bot is reading them.`,
        );
        await reload({ quiet: true });
      } catch (err) {
        show(
          err instanceof Error ? err.message : "Upload failed.",
          "error",
        );
      } finally {
        setUploading(false);
      }
    },
    [reload, show],
  );

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void upload(Array.from(event.dataTransfer.files));
  }

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await api.deleteDocument(target.id);
      show(`Deleted "${target.title}".`);
      setTarget(null);
      await reload({ quiet: true });
    } catch (err) {
      show(
        err instanceof Error ? err.message : "Delete failed.",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Knowledge base"
        description="The bot only answers from the documents here. The clearer your documents, the better its answers."
      />

      {/* Vùng tải lên */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border border-dashed px-6 py-10 text-center transition-colors duration-150",
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line-strong bg-surface",
        )}
      >
        <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-line text-faint">
          {uploading ? (
            <Spinner size={16} />
          ) : (
            <UploadIcon className="size-[18px]" />
          )}
        </div>
        <p className="mt-4 text-sm font-medium">
          {uploading ? "Uploading…" : "Drop documents here"}
        </p>
        <p className="mt-1 text-[13px] text-faint">
          PDF, Word (.docx), .txt, .md — up to 10 MB
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          Browse files
        </Button>
      </div>

      {rejected.length ? (
        <Alert
          className="mt-4"
          action={
            <Button size="sm" variant="ghost" onClick={() => setRejected([])}>
              Dismiss
            </Button>
          }
        >
          <p className="font-medium">
            Couldn't upload {rejected.length} file(s):
          </p>
          <ul className="mt-1 space-y-0.5">
            {rejected.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {error && !data ? (
        <Alert
          className="mt-4"
          action={
            <Button size="sm" variant="secondary" onClick={() => reload()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {/* Danh sách */}
      <Card className="mt-10 overflow-hidden">
        {loading && !data ? (
          <ul className="divide-y divide-line">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="px-6 py-5">
                <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
              </li>
            ))}
          </ul>
        ) : data && data.length === 0 ? (
          <EmptyState
            icon={<DocumentIcon className="size-5" />}
            title="The bot has nothing to read yet"
            description="Upload a price list, return policy, or FAQ. A single document is enough for the bot to start answering."
            action={
              <Button
                variant="primary"
                onClick={() => inputRef.current?.click()}
              >
                Browse files
              </Button>
            }
          />
        ) : data ? (
          <>
            {/* Màn hình hẹp: mỗi tài liệu là một khối, không ép người dùng kéo ngang bảng. */}
            <ul className="divide-y divide-line md:hidden">
              {data.map((doc) => (
                <li key={doc.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{doc.title}</p>
                      {doc.status === "FAILED" && doc.error ? (
                        <p className="mt-1 text-[12.5px] text-danger">
                          {doc.error}
                        </p>
                      ) : doc.fileName ? (
                        <p className="mt-0.5 truncate text-[12.5px] text-faint">
                          {doc.fileName}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTarget(doc)}
                      aria-label={`Delete ${doc.title}`}
                      className="-m-1 shrink-0 rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-faint">
                    <StatusBadge status={doc.status} />
                    <span className="font-mono">{doc.sourceType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular">
                      {formatFileSize(doc.fileSize)}
                    </span>
                    {doc.status === "READY" ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular">
                          {formatNumber(doc.chunkCount)} chunks
                        </span>
                      </>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <span className="tabular">{formatDate(doc.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[12px] text-faint">
                    <th scope="col" className="px-6 py-3 font-medium">
                      Document
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-medium"
                    >
                      Size
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-medium"
                    >
                      Chunks
                    </th>
                    <th
                      scope="col"
                      className="hidden px-3 py-3 font-medium lg:table-cell"
                    >
                      Uploaded
                    </th>
                    <th scope="col" className="px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((doc) => (
                    <tr
                      key={doc.id}
                      className="group border-b border-line last:border-0 transition-colors duration-150 hover:bg-hover"
                    >
                      <td className="max-w-[280px] px-6 py-4">
                        <div className="truncate font-medium" title={doc.title}>
                          {doc.title}
                        </div>
                        {doc.status === "FAILED" && doc.error ? (
                          <div className="mt-1 flex items-start gap-1.5 text-[12.5px] text-danger">
                            {doc.error}
                          </div>
                        ) : doc.fileName ? (
                          <div className="mt-0.5 truncate text-[12.5px] text-faint">
                            {doc.fileName}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4">
                        <span className="font-mono text-[12px] text-faint">
                          {doc.sourceType}
                        </span>
                      </td>
                      <td className="tabular px-3 py-4 text-right text-soft">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="px-3 py-4">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="tabular px-3 py-4 text-right text-soft">
                        {doc.status === "READY"
                          ? formatNumber(doc.chunkCount)
                          : "—"}
                      </td>
                      <td className="tabular hidden px-3 py-4 text-soft lg:table-cell">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setTarget(doc)}
                          aria-label={`Delete ${doc.title}`}
                          className="rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>

      {inFlight ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-faint">
          <Spinner size={13} />
          Processing documents — the list updates itself.
        </p>
      ) : null}

      <ConfirmDialog
        open={target !== null}
        title="Delete this document?"
        description={
          target ? (
            <>
              <span className="font-medium text-text">{target.title}</span> will be
              deleted
              {target.chunkCount > 0 ? (
                <>
                  , along with{" "}
                  <span className="font-medium text-text">
                    {formatNumber(target.chunkCount)} learned chunks
                  </span>{" "}
                  from it. The bot will no longer be able to answer questions based on this content.
                </>
              ) : (
                <> from the list. It has not finished processing, so no chunks were learned yet.</>
              )}{" "}
              This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete document"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}

import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/Layout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { AlertIcon, ChatIcon, ChevronLeftIcon, DocumentIcon } from "../components/ui/icons";
import { useAsync } from "../hooks/useAsync";
import * as api from "../lib/api";
import { cn } from "../lib/cn";
import { formatDateTime, formatTime, relativeTime } from "../lib/format";
import type { Conversation, ConversationDetail, Message } from "../lib/types";

/** Dưới ngưỡng này nghĩa là bot phải đoán — chỗ tài liệu còn thiếu. */
const LOW_CONFIDENCE = 0.7;

export function ConversationsPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("c");

  const loadList = useCallback(() => api.listConversations(1), []);
  const list = useAsync(loadList);

  const loadDetail = useCallback(
    (): Promise<ConversationDetail | null> =>
      selectedId ? api.getConversation(selectedId) : Promise.resolve(null),
    [selectedId],
  );
  const detail = useAsync(loadDetail);

  // Trên màn hình rộng thì mở sẵn hội thoại mới nhất; màn hình hẹp để người
  // dùng tự chọn, tránh nhảy thẳng vào một hội thoại họ chưa nhìn thấy.
  const items = list.data?.items;
  useEffect(() => {
    if (selectedId || !items?.length) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    setParams({ c: items[0].id }, { replace: true });
  }, [items, selectedId, setParams]);

  const select = (id: string) => setParams({ c: id });
  const clear = () => setParams({});

  const lowConfidenceCount =
    detail.data?.messages.filter(
      (m) => m.role === "ASSISTANT" && m.confidence != null && m.confidence < LOW_CONFIDENCE,
    ).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Conversations"
        title="What customers asked"
        description="Read back real conversations. Wherever the bot sounded unsure is exactly where your documents need more detail."
      />

      {list.error && !list.data ? (
        <Alert
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" onClick={() => list.reload()}>
              Retry
            </Button>
          }
        >
          {list.error}
        </Alert>
      ) : null}

      {list.loading && !list.data ? (
        <Card className="p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-sunken" />
          <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-sunken" />
          <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-sunken" />
        </Card>
      ) : items && items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ChatIcon className="size-5" />}
            title="No conversations yet"
            description="When customers start chatting on your website, every question and answer will be saved here for you to review."
          />
        </Card>
      ) : items ? (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Danh sách */}
          <Card
            className={cn(
              "overflow-hidden lg:sticky lg:top-8 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto",
              selectedId ? "hidden lg:block" : "block",
            )}
          >
            <ul className="divide-y divide-line">
              {items.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === selectedId}
                  onSelect={() => select(conversation.id)}
                />
              ))}
            </ul>
          </Card>

          {/* Nội dung */}
          <Card className={cn("min-h-[420px]", selectedId ? "block" : "hidden lg:block")}>
            {!selectedId ? (
              <EmptyState
                icon={<ChatIcon className="size-5" />}
                title="Select a conversation"
                description="Click a conversation on the left to see the full exchange."
              />
            ) : detail.loading && !detail.data ? (
              <div className="flex h-[420px] items-center justify-center text-faint">
                <Spinner size={20} />
              </div>
            ) : detail.error ? (
              <div className="p-6">
                <Alert
                  action={
                    <Button size="sm" variant="secondary" onClick={() => detail.reload()}>
                      Retry
                    </Button>
                  }
                >
                  {detail.error}
                </Alert>
              </div>
            ) : detail.data ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={clear}
                      className="mb-2 inline-flex items-center gap-1 rounded-sm text-[13px] text-soft hover:text-text lg:hidden"
                    >
                      <ChevronLeftIcon className="size-4" />
                      All conversations
                    </button>
                    <h2 className="font-display text-[17px] font-medium">
                      Visitor {detail.data.visitorId ?? "anonymous"}
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-faint">
                      Started {formatDateTime(detail.data.createdAt)} ·{" "}
                      {detail.data.messages.length} messages
                    </p>
                  </div>
                  {lowConfidenceCount > 0 ? (
                    <span className="hidden shrink-0 items-center gap-1.5 text-[12.5px] text-warn sm:inline-flex">
                      <AlertIcon className="size-3.5" />
                      {lowConfidenceCount} uncertain answers
                    </span>
                  ) : null}
                </div>

                <div className="space-y-6 px-6 py-7">
                  {detail.data.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </div>
              </>
            ) : null}
          </Card>
        </div>
      ) : null}
    </>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "relative block w-full px-5 py-4 text-left transition-colors duration-150",
          selected ? "bg-accent-soft" : "hover:bg-hover",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-0.5 transition-opacity duration-150",
            selected ? "bg-accent opacity-100" : "opacity-0",
          )}
        />
        <p
          className={cn(
            "line-clamp-2 text-[13.5px] leading-relaxed",
            selected ? "font-medium text-text" : "text-soft",
          )}
        >
          {conversation.preview}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-faint">
          <span className="tabular-nums">{relativeTime(conversation.updatedAt)}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{conversation.messageCount} msgs</span>
        </div>
      </button>
    </li>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "USER";
  const uncertain =
    !isUser && message.confidence != null && message.confidence < LOW_CONFIDENCE;

  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[80%] rounded-lg rounded-br-sm bg-sunken px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
        <time
          className="mt-1.5 text-[11.5px] text-faint tabular-nums"
          dateTime={message.createdAt}
        >
          {formatTime(message.createdAt)}
        </time>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <div
        className={cn(
          "max-w-[80%] rounded-lg rounded-bl-sm border px-4 py-2.5 text-sm leading-relaxed",
          uncertain ? "border-warn-line border-l-2 border-l-warn bg-surface" : "border-line",
        )}
      >
        {message.content}

        {message.citations.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
            {message.citations.map((citation) => (
              <span
                key={citation.chunkId}
                className="inline-flex max-w-full items-start gap-1.5 rounded-2xl border border-line px-2.5 py-0.5 text-left text-[11.5px] text-faint"
              >
                <DocumentIcon className="mt-1 size-3 shrink-0" />
                {/* Không cắt cụt: biết bot lấy từ tài liệu nào mới là điều quan trọng. */}
                <span className="min-w-0 break-words">Source: {citation.title}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Ghi chú lề: đây là insight quan trọng nhất của trang này. */}
      {uncertain ? (
        <p className="mt-1.5 flex max-w-[80%] items-start gap-1.5 text-[12px] leading-relaxed text-warn">
          <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
          The bot wasn't sure here — your documents may not cover it. Add more detail so it can answer with confidence next time.
        </p>
      ) : (
        <time
          className="mt-1.5 text-[11.5px] text-faint tabular-nums"
          dateTime={message.createdAt}
        >
          {formatTime(message.createdAt)}
        </time>
      )}
    </div>
  );
}

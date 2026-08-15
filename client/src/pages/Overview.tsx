import { useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/Layout";
import { EmbedSnippet } from "../components/EmbedSnippet";
import { MessagesChart } from "../components/MessagesChart";
import { StatTile, StatTileSkeleton } from "../components/StatTile";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ChatIcon, ChevronLeftIcon } from "../components/ui/icons";
import { useAsync } from "../hooks/useAsync";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatNumber, relativeTime } from "../lib/format";
import type { Conversation, Usage } from "../lib/types";

interface OverviewData {
  usage: Usage;
  conversations: Conversation[];
}

export function OverviewPage() {
  const { tenant } = useAuth();

  const load = useCallback(async (): Promise<OverviewData> => {
    const [usage, page] = await Promise.all([api.getUsage(30), api.listConversations(1)]);
    return { usage, conversations: page.items };
  }, []);

  const { data, error, loading, reload } = useAsync(load);

  const thisMonth = (() => {
    if (!data) return 0;
    const now = new Date();
    return data.conversations.filter((c) => {
      const d = new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  })();

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Your chatbot"
        description="The last 30 days at a glance: what customers asked and what the bot has learned."
      />

      {/* Việc đầu tiên của một công ty mới: đưa chatbot lên website. */}
      <Card tone="accent" className="mb-12">
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-medium">Put the chatbot on your website</h2>
            <Link
              to="/app/settings"
              className="rounded-sm text-[13px] text-accent-text underline-offset-4 hover:underline"
            >
              Customize the widget
            </Link>
          </div>
          <p className="mt-1 text-[13px] text-soft">
            Paste this snippet into your website, right before the{" "}
            <code className="font-mono text-[12px]">&lt;/body&gt;</code>.
          </p>
          {tenant ? <EmbedSnippet publicKey={tenant.publicKey} className="mt-4" /> : null}
        </div>
      </Card>

      {error && !data ? (
        <Alert
          className="mb-12"
          action={
            <Button size="sm" variant="secondary" onClick={() => reload()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {/* Số liệu */}
      <div className="mb-14 grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-4">
        {loading && !data ? (
          <>
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </>
        ) : data ? (
          <>
            <StatTile
              label="AI messages"
              value={data.usage.totalMessages}
              note="Last 30 days"
            />
            <StatTile
              label="Documents"
              value={data.usage.totalDocuments}
              note={<Link to="/app/documents" className="hover:text-soft">Manage documents</Link>}
            />
            <StatTile
              label="Chunks learned"
              value={data.usage.totalChunks}
              note="The bot searches these for answers"
            />
            <StatTile label="Conversations this month" value={thisMonth} />
          </>
        ) : null}
      </div>

      {/* Biểu đồ */}
      <Card className="mb-14">
        <CardHeader
          title="AI messages per day"
          description={
            data
              ? `${formatNumber(data.usage.totalMessages)} messages in the last 30 days`
              : "Last 30 days"
          }
        />
        <div className="px-6 py-6">
          {loading && !data ? (
            <div className="h-[200px] animate-pulse rounded-md bg-sunken" />
          ) : data ? (
            <MessagesChart data={data.usage.daily} />
          ) : null}
        </div>
      </Card>

      {/* Hội thoại gần nhất */}
      <Card>
        <CardHeader
          title="Recent conversations"
          action={
            <Link
              to="/app/conversations"
              className="inline-flex items-center gap-1 rounded-sm text-[13px] text-soft underline-offset-4 hover:text-text hover:underline"
            >
              View all
              <ChevronLeftIcon className="size-3.5 rotate-180" />
            </Link>
          }
        />

        {loading && !data ? (
          <ul className="divide-y divide-line">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="px-6 py-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-sunken" />
              </li>
            ))}
          </ul>
        ) : data && data.conversations.length === 0 ? (
          <EmptyState
            icon={<ChatIcon className="size-5" />}
            title="No one has messaged yet"
            description="Once you paste the snippet above into your website, the first conversations will show up here."
          />
        ) : data ? (
          <ul className="divide-y divide-line">
            {data.conversations.slice(0, 5).map((conversation) => (
              <li key={conversation.id}>
                <Link
                  to={`/app/conversations?c=${conversation.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors duration-150 hover:bg-hover"
                >
                  <p className="min-w-0 flex-1 truncate text-sm">{conversation.preview}</p>
                  <span className="tabular shrink-0 text-[12px] text-faint">
                    {conversation.messageCount} msgs
                  </span>
                  <span className="shrink-0 text-[12px] text-faint tabular-nums">
                    {relativeTime(conversation.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}

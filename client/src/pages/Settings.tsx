import { useState, type FormEvent, type KeyboardEvent } from "react";
import { PageHeader } from "../components/Layout";
import { EmbedSnippet } from "../components/EmbedSnippet";
import { WidgetPreview } from "../components/WidgetPreview";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { CloseIcon } from "../components/ui/icons";
import { useToast } from "../components/ui/Toast";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { isHexColor } from "../lib/color";

/** Bỏ http://, đường dẫn, dấu / thừa — người dùng hay dán cả URL. */
function normalizeDomain(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function SettingsPage() {
  const { tenant, applyTenant } = useAuth();
  const { show } = useToast();

  const [title, setTitle] = useState(tenant?.widgetTitle ?? "");
  const [greeting, setGreeting] = useState(tenant?.widgetGreeting ?? "");
  const [color, setColor] = useState(tenant?.widgetColor ?? "#166F5C");
  const [colorError, setColorError] = useState<string | null>(null);

  const [domains, setDomains] = useState<string[]>(tenant?.allowedDomains ?? []);
  const [domainDraft, setDomainDraft] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);

  const [savingWidget, setSavingWidget] = useState(false);
  const [savingDomains, setSavingDomains] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Đồng bộ form khi dữ liệu công ty đổi (khôi phục phiên xong, hoặc vừa lưu):
  // đặt lại state ngay trong lúc render — cách React khuyến nghị thay cho effect.
  const [syncedFrom, setSyncedFrom] = useState(tenant);
  if (tenant && tenant !== syncedFrom) {
    setSyncedFrom(tenant);
    setTitle(tenant.widgetTitle);
    setGreeting(tenant.widgetGreeting);
    setColor(tenant.widgetColor);
    setDomains(tenant.allowedDomains);
  }

  if (!tenant) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-faint">
        <Spinner size={20} />
      </div>
    );
  }

  const widgetDirty =
    title !== tenant.widgetTitle ||
    greeting !== tenant.widgetGreeting ||
    color !== tenant.widgetColor;

  const domainsDirty = domains.join(",") !== tenant.allowedDomains.join(",");

  async function saveWidget(event: FormEvent) {
    event.preventDefault();
    if (!isHexColor(color)) {
      setColorError("Color must be in #RRGGBB format, e.g. #166F5C.");
      return;
    }
    setColorError(null);
    setSaveError(null);
    setSavingWidget(true);
    try {
      const updated = await api.updateTenant({
        widgetTitle: title.trim(),
        widgetGreeting: greeting.trim(),
        widgetColor: color,
      });
      applyTenant(updated);
      show("Widget appearance saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSavingWidget(false);
    }
  }

  function addDomain() {
    const value = normalizeDomain(domainDraft);
    if (!value) return;
    if (!DOMAIN_PATTERN.test(value)) {
      setDomainError(`"${value}" doesn't look like a domain. Example: yourcompany.com`);
      return;
    }
    if (domains.includes(value)) {
      setDomainError(`"${value}" is already on the list.`);
      return;
    }
    setDomains((list) => [...list, value]);
    setDomainDraft("");
    setDomainError(null);
  }

  function onDomainKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addDomain();
    } else if (event.key === "Backspace" && !domainDraft && domains.length) {
      setDomains((list) => list.slice(0, -1));
    }
  }

  async function saveDomains() {
    setSaveError(null);
    setSavingDomains(true);
    try {
      const updated = await api.updateTenant({ allowedDomains: domains });
      applyTenant(updated);
      show(
        domains.length
          ? `Saved ${domains.length} allowed domain(s).`
          : "Saved. The widget now runs on any domain.",
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSavingDomains(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Your widget"
        description="Put the chatbot on your website, match it to your brand, and control where it's allowed to run."
      />

      {saveError ? <Alert className="mb-6">{saveError}</Alert> : null}

      {/* Mã nhúng */}
      <Card className="mb-8">
        <CardHeader
          title="Embed snippet"
          description="Paste it once — no need to touch it again when you change documents or styling."
        />
        <div className="px-6 py-5">
          <EmbedSnippet publicKey={tenant.publicKey} />
          <p className="mt-4 text-[13px] leading-relaxed text-faint">
            Paste the snippet into your website source, right before the closing{" "}
            <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[12px] text-soft">
              &lt;/body&gt;
            </code>
            . On WordPress, Shopify, or Wix, look for "Custom code" in your theme settings.
          </p>
        </div>
      </Card>

      {/* Tuỳ biến widget */}
      <Card className="mb-8">
        <CardHeader
          title="Widget appearance"
          description="Your customers see exactly what's shown in the preview."
        />
        <div className="grid gap-10 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={saveWidget} className="space-y-5">
            <Input
              label="Chat window title"
              value={title}
              maxLength={48}
              onChange={(e) => setTitle(e.target.value)}
              hint="Usually your company or support team name."
            />

            <div>
              <label
                htmlFor="widget-greeting"
                className="mb-1.5 block text-[13px] font-medium text-soft"
              >
                First greeting
              </label>
              <textarea
                id="widget-greeting"
                rows={3}
                maxLength={160}
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2.5 text-sm outline-none transition-colors duration-150 placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
              <p className="mt-1.5 text-[13px] text-faint">
                What the bot says when a customer opens the chat. {greeting.length}/160 characters.
              </p>
            </div>

            <div>
              <label
                htmlFor="widget-color"
                className="mb-1.5 block text-[13px] font-medium text-soft"
              >
                Brand color
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="widget-color"
                  type="color"
                  value={isHexColor(color) ? color : "#166F5C"}
                  onChange={(e) => {
                    setColor(e.target.value.toUpperCase());
                    setColorError(null);
                  }}
                  className="size-10 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1"
                  aria-label="Pick a brand color"
                />
                <input
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value.toUpperCase());
                    setColorError(null);
                  }}
                  spellCheck={false}
                  aria-invalid={colorError ? true : undefined}
                  className="h-10 w-32 rounded-md border border-line bg-surface px-3 font-mono text-sm outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>
              {colorError ? (
                <p role="alert" className="mt-1.5 text-[13px] text-danger">
                  {colorError}
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] text-faint">
                  Used for the title bar, chat bubbles, and send button.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                variant="primary"
                loading={savingWidget}
                disabled={!widgetDirty}
              >
                Save changes
              </Button>
              {widgetDirty ? (
                <span className="text-[13px] text-faint">Unsaved changes</span>
              ) : null}
            </div>
          </form>

          <div>
            <div className="eyebrow mb-4">Preview</div>
            <WidgetPreview
              title={title}
              greeting={greeting}
              color={isHexColor(color) ? color : "#166F5C"}
            />
          </div>
        </div>
      </Card>

      {/* Tên miền được phép */}
      <Card>
        <CardHeader
          title="Allowed domains"
          description="The widget's real layer of protection."
        />
        <div className="px-6 py-6">
          <div className="flex flex-wrap gap-2">
            {domains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunken py-1 pr-1.5 pl-3 text-[13px]"
              >
                <span className="font-mono text-[12.5px]">{domain}</span>
                <button
                  type="button"
                  onClick={() => setDomains((list) => list.filter((d) => d !== domain))}
                  aria-label={`Remove domain ${domain}`}
                  className="rounded-full p-1 text-faint transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                >
                  <CloseIcon className="size-3" />
                </button>
              </span>
            ))}
            {domains.length === 0 ? (
              <span className="text-[13px] text-faint">
                The list is empty — the widget runs on any website.
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex items-start gap-3">
            <div className="w-full max-w-xs">
              <Input
                value={domainDraft}
                onChange={(e) => {
                  setDomainDraft(e.target.value);
                  setDomainError(null);
                }}
                onKeyDown={onDomainKeyDown}
                onBlur={() => domainDraft && addDomain()}
                placeholder="yourcompany.com"
                spellCheck={false}
                error={domainError}
                aria-label="Add a domain"
              />
            </div>
            <Button onClick={addDomain} className="shrink-0">
              Add
            </Button>
          </div>

          <p className="mt-6 max-w-2xl border-t border-line pt-5 text-[13px] leading-relaxed text-faint">
            Leaving this empty allows every domain.{" "}
            <span className="text-soft">
              The public key in your snippet is readable by anyone
            </span>{" "}
            — so this list is what actually stops other websites from using your chatbot. Add every domain you use, including subdomains like shop.yourcompany.com.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => void saveDomains()}
              loading={savingDomains}
              disabled={!domainsDirty}
            >
              Save list
            </Button>
            {domainsDirty ? (
              <span className="text-[13px] text-faint">Unsaved changes</span>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}

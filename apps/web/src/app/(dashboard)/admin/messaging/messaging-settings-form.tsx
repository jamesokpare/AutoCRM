"use client";

import { Channel, EmailProvider } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import { Card } from "@crm-tool/ui/components/card";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@crm-tool/ui/components/tabs";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  saveEmailSettings,
  saveWhatsappSettings,
  sendTestMessage,
} from "@/lib/actions/messaging";
import type { MessagingSettingsView } from "@/lib/actions/messaging-types";

interface Props {
  initial: MessagingSettingsView;
}

const PROVIDER_OPTIONS = [
  { value: EmailProvider.RESEND, label: "Resend (HTTPS API)" },
  { value: EmailProvider.SMTP, label: "SMTP (not wired up yet)" },
];

export function MessagingSettingsForm({ initial }: Props) {
  return (
    <Tabs defaultValue="whatsapp">
      <TabsList>
        <TabsTab value="whatsapp">WhatsApp</TabsTab>
        <TabsTab value="email">Email</TabsTab>
      </TabsList>
      <TabsPanel value="whatsapp">
        <WhatsappForm initial={initial} />
      </TabsPanel>
      <TabsPanel value="email">
        <EmailForm initial={initial} />
      </TabsPanel>
    </Tabs>
  );
}

function WhatsappForm({ initial }: Props) {
  const wa = initial.whatsapp;
  const [enabled, setEnabled] = useState(wa.enabled);
  const [phoneNumberId, setPhoneNumberId] = useState(wa.phoneNumberId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [businessNumber, setBusinessNumber] = useState(wa.businessNumber ?? "");
  const [displayName, setDisplayName] = useState(wa.displayName ?? "");
  const [pending, startTransition] = useTransition();
  const [testTo, setTestTo] = useState("");
  const [testPending, startTestTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const res = await saveWhatsappSettings({
        enabled,
        phoneNumberId,
        accessToken: accessToken || undefined,
        businessNumber,
        displayName,
      });
      if (res.ok) toast.success("WhatsApp settings saved.");
      else toast.error(res.error ?? "Failed to save.");
    });
  };

  const sendTest = () => {
    if (!testTo.trim()) {
      toast.error("Enter a phone number to send the test to.");
      return;
    }
    startTestTransition(async () => {
      const res = await sendTestMessage({
        channel: Channel.WHATSAPP,
        destination: testTo,
        content: "Drivewell WhatsApp test — your CRM is connected.",
      });
      if (res.ok) toast.success("Test sent.");
      else toast.error(res.error ?? "Test failed.");
    });
  };

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">WhatsApp (Meta Cloud API)</h2>
        <p className="text-xs text-muted-foreground">
          Create a WhatsApp Business app at{" "}
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            developers.facebook.com/apps
          </a>
          , then paste the Phone Number ID and a permanent System User access
          token below.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => setEnabled(Boolean(c))}
        />
        Enable WhatsApp sending
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wa-pn-id">Phone Number ID</Label>
          <Input
            id="wa-pn-id"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="123456789012345"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-token">
            Access Token{" "}
            {wa.hasAccessToken && (
              <span className="text-muted-foreground">(stored — leave blank to keep)</span>
            )}
          </Label>
          <Input
            id="wa-token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={wa.hasAccessToken ? "••••••••" : "EAAG..."}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-business">Business number (display)</Label>
          <Input
            id="wa-business"
            value={businessNumber}
            onChange={(e) => setBusinessNumber(e.target.value)}
            placeholder="+234 800 000 0000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-name">Display name</Label>
          <Input
            id="wa-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Drivewell"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save WhatsApp settings"}
        </Button>
      </div>

      <div className="border-t pt-3">
        <h3 className="text-xs font-medium">Send a test</h3>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="wa-test">Recipient phone</Label>
            <Input
              id="wa-test"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="+2348012345678"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={sendTest}
            disabled={testPending}
          >
            {testPending ? "Sending…" : "Send test"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmailForm({ initial }: Props) {
  const em = initial.email;
  const [enabled, setEnabled] = useState(em.enabled);
  const [provider, setProvider] = useState<EmailProvider>(em.provider ?? EmailProvider.RESEND);
  const [fromName, setFromName] = useState(em.fromName ?? "");
  const [fromAddress, setFromAddress] = useState(em.fromAddress ?? "");
  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState(em.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(em.smtpPort ? String(em.smtpPort) : "");
  const [smtpUser, setSmtpUser] = useState(em.smtpUser ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(em.smtpSecure ?? true);
  const [pending, startTransition] = useTransition();
  const [testTo, setTestTo] = useState("");
  const [testSubject, setTestSubject] = useState("Drivewell test email");
  const [testPending, startTestTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const res = await saveEmailSettings({
        enabled,
        provider,
        fromName,
        fromAddress,
        apiKey: apiKey || undefined,
        smtpHost,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpUser,
        smtpPassword: smtpPassword || undefined,
        smtpSecure,
      });
      if (res.ok) toast.success("Email settings saved.");
      else toast.error(res.error ?? "Failed to save.");
    });
  };

  const sendTest = () => {
    if (!testTo.trim()) {
      toast.error("Enter a recipient email.");
      return;
    }
    startTestTransition(async () => {
      const res = await sendTestMessage({
        channel: Channel.EMAIL,
        destination: testTo,
        subject: testSubject || "Drivewell test",
        content: "This is a test from your Drivewell CRM. Email is connected.",
      });
      if (res.ok) toast.success("Test sent.");
      else toast.error(res.error ?? "Test failed.");
    });
  };

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Email</h2>
        <p className="text-xs text-muted-foreground">
          Connect a sending provider. Today the API-based provider (Resend) is
          wired up — paste an API key and a verified sender address.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={enabled} onCheckedChange={(c) => setEnabled(Boolean(c))} />
        Enable email sending
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="em-provider">Provider</Label>
          <Select
            items={PROVIDER_OPTIONS}
            value={provider}
            onValueChange={(v) => setProvider(v as EmailProvider)}
          >
            <SelectTrigger id="em-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="em-from-name">From name</Label>
          <Input
            id="em-from-name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Drivewell"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="em-from-addr">From address</Label>
          <Input
            id="em-from-addr"
            type="email"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="hello@drivewell.example"
          />
        </div>
        {provider === EmailProvider.RESEND ? (
          <div className="space-y-1.5">
            <Label htmlFor="em-key">
              API key{" "}
              {em.hasApiKey && (
                <span className="text-muted-foreground">(stored — leave blank to keep)</span>
              )}
            </Label>
            <Input
              id="em-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={em.hasApiKey ? "••••••••" : "re_..."}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="em-host">SMTP host</Label>
              <Input
                id="em-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.mailgun.org"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-port">SMTP port</Label>
              <Input
                id="em-port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-user">SMTP user</Label>
              <Input
                id="em-user"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-pass">
                SMTP password{" "}
                {em.hasSmtpPassword && (
                  <span className="text-muted-foreground">(stored — leave blank to keep)</span>
                )}
              </Label>
              <Input
                id="em-pass"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={smtpSecure}
                onCheckedChange={(c) => setSmtpSecure(Boolean(c))}
              />
              Use TLS / secure connection
            </label>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save email settings"}
        </Button>
      </div>

      <div className="border-t pt-3">
        <h3 className="text-xs font-medium">Send a test</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="em-test-to">Recipient email</Label>
            <Input
              id="em-test-to"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em-test-subj">Subject</Label>
            <Input
              id="em-test-subj"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="outline"
              onClick={sendTest}
              disabled={testPending}
            >
              {testPending ? "Sending…" : "Send test"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

"use client";

import { Button } from "@crm-tool/ui/components/button";
import { Card } from "@crm-tool/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm-tool/ui/components/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@crm-tool/ui/components/tabs";
import { Download, Mail, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { clearEmployeeMonthlyActivity } from "@/lib/actions/reports";

/**
 * Client-shape report — Date fields serialised to ISO strings so the payload
 * can cross the server→client boundary (Next.js requires serialisable props).
 */
export interface SerialisedReport {
  year: number;
  month: number;
  monthLabel: string;
  monthStart: string;
  monthEnd: string;
  weeks: { index: number; start: string; end: string; label: string }[];
  employees: {
    user: { id: string; name: string; email: string };
    weeks: { weekIndex: number; total: number; byEntity: Record<string, number> }[];
    total: number;
  }[];
  clients: {
    client: { id: string; name: string; status: string };
    weeks: {
      weekIndex: number;
      orders: number;
      feedback: number;
      communications: number;
      updates: number;
      total: number;
    }[];
    total: number;
  }[];
}

export function ReportView({
  report,
  monthOptions,
  plainText,
  currentUserEmail,
  canClearActivity = false,
}: {
  report: SerialisedReport;
  monthOptions: { value: string; label: string }[];
  plainText: string;
  currentUserEmail: string;
  canClearActivity?: boolean;
}) {
  const router = useRouter();
  const currentValue = `${report.year}-${report.month}`;
  const [shareOpen, setShareOpen] = useState(false);
  const [recipient, setRecipient] = useState(currentUserEmail);

  const csvUrl = `/api/reports/monthly?year=${report.year}&month=${report.month}`;

  const downloadCSV = () => {
    window.location.href = csvUrl;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      toast.success("Report copied to clipboard");
    } catch {
      toast.error("Couldn't copy — try the download instead.");
    }
  };

  const sendEmail = () => {
    const subject = encodeURIComponent(`Activity summary — ${report.monthLabel}`);
    // mailto: body length is limited by the OS / mail client (~2000 chars on
    // many setups). Truncate to keep the link valid and surface a hint.
    const limit = 1800;
    const truncated = plainText.length > limit ? `${plainText.slice(0, limit)}\n\n…(truncated — download the CSV for the full report)` : plainText;
    const body = encodeURIComponent(truncated);
    const to = encodeURIComponent(recipient.trim());
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    setShareOpen(false);
  };

  const employeesWithActivity = useMemo(
    () => report.employees.filter((e) => e.total > 0),
    [report.employees],
  );
  const clientsWithActivity = useMemo(
    () => report.clients.filter((c) => c.total > 0),
    [report.clients],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Monthly activity</h1>
          <p className="text-xs text-muted-foreground">
            Employee + client activity for {report.monthLabel}, broken down by week.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={monthOptions}
            value={currentValue}
            onValueChange={(value) => {
              const v = value as string;
              const [y, m] = v.split("-");
              router.push(`/reports?year=${y}&month=${m}`);
            }}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" onClick={downloadCSV}>
            <Download className="size-3.5" />
            Download CSV
          </Button>

          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <Mail className="size-3.5" />
                  Share by email
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share {report.monthLabel} summary</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="report-email">Recipient</Label>
                <Input
                  id="report-email"
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="name@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Opens your email client with a plain-text version of the report.
                  For the full breakdown, attach the CSV.
                </p>
              </div>
              <DialogFooter>
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  Copy to clipboard
                </Button>
                <Button size="sm" onClick={sendEmail} disabled={!recipient.includes("@")}>
                  Open email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTab value="employees">Employees</TabsTab>
          <TabsTab value="clients">Clients</TabsTab>
        </TabsList>

        <TabsPanel value="employees" className="pt-3">
          <Card className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  {report.weeks.map((w) => (
                    <TableHead key={w.index} className="text-right whitespace-nowrap">
                      {w.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                  {canClearActivity && (
                    <TableHead className="w-10 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeesWithActivity.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={report.weeks.length + 2 + (canClearActivity ? 1 : 0)}
                      className="text-center text-muted-foreground"
                    >
                      No activity recorded in {report.monthLabel}.
                    </TableCell>
                  </TableRow>
                ) : (
                  employeesWithActivity.map((emp) => (
                    <TableRow key={emp.user.id}>
                      <TableCell>
                        <div className="font-medium">{emp.user.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.user.email}</div>
                      </TableCell>
                      {emp.weeks.map((w) => (
                        <TableCell key={w.weekIndex} className="text-right tabular-nums">
                          {w.total === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            w.total
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">
                        {emp.total}
                      </TableCell>
                      {canClearActivity && (
                        <TableCell className="text-right">
                          <ClearEmployeeActivityButton
                            userId={emp.user.id}
                            name={emp.user.name}
                            year={report.year}
                            month={report.month}
                            monthLabel={report.monthLabel}
                            total={emp.total}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsPanel>

        <TabsPanel value="clients" className="pt-3">
          <Card className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  {report.weeks.map((w) => (
                    <TableHead key={w.index} className="text-right whitespace-nowrap">
                      {w.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsWithActivity.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={report.weeks.length + 2}
                      className="text-center text-muted-foreground"
                    >
                      No client activity in {report.monthLabel}.
                    </TableCell>
                  </TableRow>
                ) : (
                  clientsWithActivity.map((c) => (
                    <TableRow key={c.client.id}>
                      <TableCell>
                        <div className="font-medium">{c.client.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.client.status.toLowerCase()}
                        </div>
                      </TableCell>
                      {c.weeks.map((w) => (
                        <TableCell key={w.weekIndex} className="text-right tabular-nums">
                          {w.total === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span title={`orders ${w.orders} · feedback ${w.feedback} · comms ${w.communications} · updates ${w.updates}`}>
                              {w.total}
                            </span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">
                        {c.total}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function ClearEmployeeActivityButton({
  userId,
  name,
  year,
  month,
  monthLabel,
  total,
}: {
  userId: string;
  name: string;
  year: number;
  month: number;
  monthLabel: string;
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Clear ${name}'s activity for ${monthLabel}`}
            title={`Clear activity for ${monthLabel}`}
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear {name}&apos;s activity?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes {total} activity {total === 1 ? "entry" : "entries"} authored by{" "}
          {name} during {monthLabel}. The underlying orders, tasks and client records are
          untouched. This cannot be undone.
        </p>
        <DialogFooter>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await clearEmployeeMonthlyActivity({ userId, year, month });
                if (!res.ok) {
                  toast.error(res.error ?? "Failed to clear activity.");
                  return;
                }
                toast.success(
                  `Cleared ${res.deleted ?? 0} ${
                    (res.deleted ?? 0) === 1 ? "entry" : "entries"
                  } for ${name}`,
                );
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Clearing…" : "Clear activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

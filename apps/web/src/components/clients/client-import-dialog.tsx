"use client";

import { Button } from "@crm-tool/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import { Label } from "@crm-tool/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm-tool/ui/components/table";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { importClients } from "@/lib/actions/clients";
import type { ClientImportRow } from "@/lib/actions/clients-types";

/** Importable fields, in the order used when a file has no recognizable header. */
const FIELD_ORDER: (keyof ClientImportRow)[] = [
  "name",
  "phone",
  "email",
  "whatsapp",
  "address",
  "preferredChannel",
];

const COLUMN_LABEL: Record<keyof ClientImportRow, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  whatsapp: "WhatsApp",
  address: "Address",
  preferredChannel: "Channel",
  vehicleMakeModel: "Make & Model",
  make: "Make",
  model: "Model",
  year: "Year",
  vin: "VIN",
  description: "Issue",
  orderStatus: "Order status",
  itemRequested: "Item / Part",
  externalOrderId: "Order ID",
};

/**
 * Header-cell aliases (lower-cased) → field. Lets columns arrive in any order
 * and under common spreadsheet names. Unknown headers are ignored at import
 * time, so columns like "Date Logged" or "Logged By" pass through harmlessly.
 */
const HEADER_ALIASES: Record<string, keyof ClientImportRow> = {
  // Client
  name: "name",
  "client name": "name",
  "customer name": "name",
  "full name": "name",
  client: "name",
  customer: "name",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  tel: "phone",
  email: "email",
  "email address": "email",
  "e-mail": "email",
  whatsapp: "whatsapp",
  "whatsapp number": "whatsapp",
  address: "address",
  preferredchannel: "preferredChannel",
  "preferred channel": "preferredChannel",
  channel: "preferredChannel",
  // Vehicle
  "vehicle make & model": "vehicleMakeModel",
  "vehicle make and model": "vehicleMakeModel",
  "make & model": "vehicleMakeModel",
  "make and model": "vehicleMakeModel",
  vehicle: "vehicleMakeModel",
  make: "make",
  model: "model",
  year: "year",
  "vehicle year": "year",
  vin: "vin",
  "vin number": "vin",
  "vin#": "vin",
  // Order
  "issue description": "description",
  "order description": "description",
  description: "description",
  issue: "description",
  "order status": "orderStatus",
  status: "orderStatus",
  "item / part requested": "itemRequested",
  "item / part": "itemRequested",
  "item requested": "itemRequested",
  "part requested": "itemRequested",
  "parts requested": "itemRequested",
  item: "itemRequested",
  part: "itemRequested",
  parts: "itemRequested",
  "order id": "externalOrderId",
  "order #": "externalOrderId",
  "order number": "externalOrderId",
  "external order id": "externalOrderId",
};

const TEMPLATE =
  "name,phone,email,whatsapp,address,preferredChannel,vehicleMakeModel,year,vin,description,orderStatus,itemRequested,externalOrderId\n" +
  "Jane Doe,+2348012345678,jane@example.com,+2348012345678,12 Allen Ave Lagos,WHATSAPP,Toyota Camry,2021,1HGCM82633A123456,Brake noise on cold start,IN_PROGRESS,Front brake pads,ORD-1042\n" +
  "Auto Spares Ltd,+2348098765432,info@autospares.example,,Ikeja Lagos,EMAIL,,,,,,,\n";

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes (""),
 * commas/newlines inside quotes, and CRLF. Returns a grid of trimmed-on-use
 * cell strings; fully blank rows are dropped.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Turn raw CSV/pasted text into typed client rows. */
function toRows(text: string): ClientImportRow[] {
  const grid = parseCsv(text);
  if (grid.length === 0) return [];

  const headerCells = grid[0].map((h) => h.trim().toLowerCase());
  const hasHeader = headerCells.some((h) => h in HEADER_ALIASES);

  const colMap: (keyof ClientImportRow | null)[] = hasHeader
    ? headerCells.map((h) => HEADER_ALIASES[h] ?? null)
    : grid[0].map((_, i) => FIELD_ORDER[i] ?? null);

  const dataRows = hasHeader ? grid.slice(1) : grid;

  return dataRows.map((cells) => {
    const row: ClientImportRow = { name: "" };
    cells.forEach((cell, i) => {
      const key = colMap[i];
      if (key) row[key] = cell.trim();
    });
    return row;
  });
}

/**
 * CLT bulk import. Accepts a CSV file upload or pasted CSV text, parses + maps
 * columns in the browser, shows a preview, then sends the rows to the
 * `importClients` server action. Rows without a name are flagged and skipped.
 */
export function ClientImportDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const rows = useMemo(() => (text.trim() ? toRows(text) : []), [text]);
  const validRows = useMemo(() => rows.filter((r) => r.name.trim() !== ""), [rows]);
  const skipped = rows.length - validRows.length;
  /** Preview only shows columns that actually carry a value in this batch. */
  const previewColumns = useMemo<(keyof ClientImportRow)[]>(() => {
    const all = Object.keys(COLUMN_LABEL) as (keyof ClientImportRow)[];
    return all.filter((k) => validRows.some((r) => (r[k] ?? "").toString().trim() !== ""));
  }, [validRows]);

  function reset() {
    setText("");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast.error("Could not read that file.");
    const isXlsx = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(file.name);
    if (isXlsx) {
      reader.onload = () => {
        try {
          const wb = XLSX.read(reader.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          if (!sheet) {
            toast.error("That spreadsheet has no sheets.");
            return;
          }
          setText(XLSX.utils.sheet_to_csv(sheet));
        } catch {
          toast.error("Could not parse that spreadsheet.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => setText(String(reader.result ?? ""));
      reader.readAsText(file);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport() {
    if (validRows.length === 0) {
      toast.error("Nothing to import — add at least one row with a name.");
      return;
    }
    startTransition(async () => {
      const res = await importClients(validRows);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Import failed.");
        return;
      }
      const {
        created,
        skipped: serverSkipped,
        vehiclesCreated,
        ordersCreated,
      } = res.data;
      const parts = [`Imported ${created} client${created === 1 ? "" : "s"}`];
      if (vehiclesCreated) parts.push(`${vehiclesCreated} vehicle${vehiclesCreated === 1 ? "" : "s"}`);
      if (ordersCreated) parts.push(`${ordersCreated} order${ordersCreated === 1 ? "" : "s"}`);
      if (serverSkipped) parts.push(`${serverSkipped} skipped`);
      toast.success(parts.join(" · "));
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import clients</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Upload a <code>.csv</code> or <code>.xlsx</code> file or paste rows below. Column
            headers are matched by name (case-insensitive) so common variants work — e.g.{" "}
            <code>Customer Name</code>, <code>Phone Number</code>, <code>Vehicle Make &amp; Model</code>,{" "}
            <code>VIN Number</code>, <code>Order ID</code>, <code>Item / Part Requested</code>,{" "}
            <code>Order status</code>, <code>Issue Description</code>. Unknown columns (e.g.{" "}
            <code>Date Logged</code>, <code>Logged By</code>) are ignored. Only <strong>name</strong>{" "}
            is required; a vehicle is created when make, model and a 4-digit year are present, and
            an order is created when an issue description is present.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="csvFile">CSV or Excel file</Label>
              <input
                id="csvFile"
                type="file"
                accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.ods,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={onFile}
                className="text-xs file:mr-2 file:rounded-none file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs"
              />
            </div>
            <Button type="button" size="xs" variant="outline" onClick={downloadTemplate}>
              Download template
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="csvText">Or paste CSV</Label>
            <Textarea
              id="csvText"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"name,phone,email\nJane Doe,+234...,jane@example.com"}
              className="font-mono text-xs"
            />
          </div>

          {rows.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">
                {validRows.length} client{validRows.length === 1 ? "" : "s"} ready
                {skipped > 0 ? ` · ${skipped} row${skipped === 1 ? "" : "s"} missing a name` : ""}.
                {validRows.length > 8 ? " Showing first 8." : ""}
              </p>
              <div className="max-h-64 overflow-auto border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewColumns.map((f) => (
                        <TableHead key={f} className="text-xs">
                          {COLUMN_LABEL[f]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 8).map((r, i) => (
                      <TableRow key={i}>
                        {previewColumns.map((f) => (
                          <TableCell key={f} className="text-xs">
                            {r[f] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" size="sm" onClick={onImport} disabled={pending || validRows.length === 0}>
            {pending
              ? "Importing…"
              : `Import ${validRows.length || ""} client${validRows.length === 1 ? "" : "s"}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { auth } from "@crm-tool/auth";
import { CommunicationState, OrderStatus, type Role } from "@crm-tool/db";
import { Button } from "@crm-tool/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-tool/ui/components/card";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ApologyDialog } from "@/components/clients/apology-dialog";
import { ClientDeleteButton, ClientStatusControl } from "@/components/clients/client-actions";
import { ClientForm } from "@/components/clients/client-form";
import { ClientUpdateForm } from "@/components/clients/client-update-form";
import { FeedbackForm } from "@/components/clients/feedback-form";
import { AddPart, PartControl, StatusControl } from "@/components/clients/order-actions";
import { OrderForm } from "@/components/clients/order-form";
import {
  ClientStatusBadge,
  DueTodayBadge,
  PartAvailabilityBadge,
  StatusBadge,
} from "@/components/clients/status-badge";
import { VehicleForm } from "@/components/clients/vehicle-form";
import {
  getClientActivity,
  getClientDetail,
  getFeedbackAggregate,
} from "@/lib/queries/clients";
import { can } from "@/lib/rbac";

const APOLOGY_ELIGIBLE: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.ON_HOLD];

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as { id: string; roles?: Role[] } | undefined;
  const roles = (user?.roles ?? []) as Role[];

  // Editing client details and changing job status are open to every signed-in
  // team member. Parts + AI apology remain role-gated.
  const canEdit = true;
  const canStatus = true;
  const canParts = can(roles, "update_parts");
  const canApology = can(roles, "use_ai_apology");

  const client = await getClientDetail(id);
  if (!client) notFound();

  const orderIds = client.orders.map((o) => o.id);
  const [activity, feedbackAgg] = await Promise.all([
    getClientActivity(client.id, orderIds),
    getFeedbackAggregate(client.id),
  ]);

  const vehicleOptions = client.vehicles.map((v) => ({
    id: v.id,
    label: `${v.year} ${v.make} ${v.model}${v.plate ? ` · ${v.plate}` : ""}`,
  }));
  const orderChoices = client.orders.map((o) => ({ id: o.id, label: o.description.slice(0, 60) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{client.name}</h1>
            <ClientStatusBadge status={client.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {[client.phone, client.email, client.whatsapp].filter(Boolean).join(" · ") || "No contact details"}
            {client.preferredChannel ? ` · prefers ${client.preferredChannel}` : ""}
          </p>
          {client.address ? <p className="text-xs text-muted-foreground">{client.address}</p> : null}
          <p className="text-xs text-muted-foreground">Last updated {fmtDateTime(client.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <ClientStatusControl clientId={client.id} current={client.status} />
          ) : null}
          <FeedbackForm
            clientId={client.id}
            orders={orderChoices}
            trigger={<Button size="sm" variant="outline">Log feedback</Button>}
          />
          {canEdit ? (
            <ClientForm
              initial={{
                id: client.id,
                name: client.name,
                phone: client.phone,
                email: client.email,
                whatsapp: client.whatsapp,
                address: client.address,
                preferredChannel: client.preferredChannel,
              }}
              trigger={<Button size="sm" variant="outline">Edit client</Button>}
            />
          ) : null}
          {canEdit ? (
            <ClientDeleteButton clientId={client.id} clientName={client.name} />
          ) : null}
        </div>
      </div>

      {/* Feedback aggregate (FB-03/04) */}
      <Card className="gap-2 p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-2xl font-semibold tabular-nums">
              {feedbackAgg.average !== null ? feedbackAgg.average.toFixed(1) : "—"}
              <span className="text-sm text-muted-foreground"> / 5</span>
            </div>
            <div className="text-xs text-muted-foreground">{feedbackAgg.count} rating(s)</div>
          </div>
          <div className="flex items-end gap-1">
            {feedbackAgg.recent
              .slice()
              .reverse()
              .map((f, i) => (
                <span
                  key={i}
                  title={`${f.rating}/5 · ${fmt(f.createdAt)}`}
                  className="w-2 rounded-none bg-primary/70"
                  style={{ height: `${f.rating * 6}px` }}
                />
              ))}
            {feedbackAgg.recent.length > 0 ? (
              <span className="ml-2 text-xs text-muted-foreground">recent trend</span>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Vehicles */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Vehicles</h2>
          {canEdit ? (
            <VehicleForm
              clientId={client.id}
              trigger={<Button size="xs" variant="outline">Add vehicle</Button>}
            />
          ) : null}
        </div>
        {client.vehicles.length === 0 ? (
          <p className="text-xs text-muted-foreground">No vehicles yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {client.vehicles.map((v) => (
              <Card key={v.id} className="gap-1 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {v.year} {v.make} {v.model}
                  </div>
                  {canEdit ? (
                    <VehicleForm
                      clientId={client.id}
                      initial={v}
                      trigger={<Button size="xs" variant="outline">Edit</Button>}
                    />
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[v.plate, v.vin, v.color, v.mileage ? `${v.mileage} mi` : null]
                    .filter(Boolean)
                    .join(" · ") || "No details"}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Orders */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Orders</h2>
          {canEdit && client.vehicles.length > 0 ? (
            <OrderForm
              clientId={client.id}
              vehicles={vehicleOptions}
              trigger={<Button size="xs" variant="outline">New order</Button>}
            />
          ) : null}
        </div>
        {client.orders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {client.orders.map((order) => {
              const apologyEligible =
                APOLOGY_ELIGIBLE.includes(order.status) ||
                (order.expectedDate ? order.expectedDate.getTime() < Date.now() : false);
              return (
                <Card key={order.id} className="gap-3 p-4">
                  <CardHeader className="p-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm">{order.description}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {order.vehicle.year} {order.vehicle.make} {order.vehicle.model} · received{" "}
                          {fmt(order.receivedDate)} · expected {fmt(order.expectedDate)} ·{" "}
                          {order.assignedTechName ?? order.assignedTech?.name ?? "Unassigned"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DueTodayBadge expectedDate={order.expectedDate} status={order.status} />
                        <StatusBadge status={order.status} />
                        {canEdit ? (
                          <OrderForm
                            clientId={client.id}
                            vehicles={vehicleOptions}
                            initial={{
                              id: order.id,
                              description: order.description,
                              vehicleId: order.vehicleId,
                              receivedDate: fmtDateInput(order.receivedDate),
                              expectedDate: fmtDateInput(order.expectedDate),
                              assignedTechName: order.assignedTechName,
                            }}
                            trigger={<Button size="xs" variant="outline">Edit</Button>}
                          />
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3 p-0">
                    {order.statusReason ? (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Reason: {order.statusReason}
                      </p>
                    ) : null}

                    {canStatus ? <StatusControl orderId={order.id} current={order.status} /> : null}

                    {/* Parts */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">Parts</div>
                      {order.parts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No parts listed.</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {order.parts.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2">
                              <span>{p.name}</span>
                              {canParts ? (
                                <PartControl partId={p.id} current={p.availability} />
                              ) : (
                                <PartAvailabilityBadge availability={p.availability} />
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {canParts ? <AddPart orderId={order.id} /> : null}
                    </div>

                    {canApology && apologyEligible ? (
                      <div>
                        <ApologyDialog
                          orderId={order.id}
                          trigger={<Button size="xs" variant="outline">Draft apology</Button>}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Daily client updates — open to all signed-in users */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Daily updates</h2>
          <ClientUpdateForm
            clientId={client.id}
            trigger={<Button size="xs" variant="outline">Add update</Button>}
          />
        </div>
        {client.updates.length === 0 ? (
          <p className="text-xs text-muted-foreground">No daily updates yet.</p>
        ) : (
          <div className="space-y-2">
            {client.updates.map((u) => (
              <Card key={u.id} className="gap-1 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fmtDateTime(u.createdAt)}</span>
                  <ClientUpdateForm
                    clientId={client.id}
                    update={{ id: u.id, note: u.note }}
                    trigger={<Button size="xs" variant="ghost">Edit</Button>}
                  />
                </div>
                <p className="whitespace-pre-wrap">{u.note}</p>
                <div className="text-xs text-muted-foreground">— {u.author.name}</div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Communications log */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Communications</h2>
        {client.communications.length === 0 ? (
          <p className="text-xs text-muted-foreground">No communications logged.</p>
        ) : (
          <div className="space-y-2">
            {client.communications.map((c) => (
              <Card key={c.id} className="gap-1 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {c.type} · {c.channel} ·{" "}
                    {c.state === CommunicationState.DRAFT ? "Draft" : "Sent"}
                  </span>
                  <span>{fmtDateTime(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.content}</p>
                <div className="text-xs text-muted-foreground">— {c.sender.name}</div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Feedback list */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Feedback</h2>
        {client.feedback.length === 0 ? (
          <p className="text-xs text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="space-y-2">
            {client.feedback.map((f) => (
              <Card key={f.id} className="gap-1 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{f.rating} / 5</span>
                  <span>{fmtDateTime(f.createdAt)}</span>
                </div>
                {f.comments ? <p>{f.comments}</p> : null}
                <div className="text-xs text-muted-foreground">— {f.createdBy.name}</div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Status history / activity log (DASH-04) */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Activity history</h2>
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span>
                  <span className="font-medium">{a.entityType}</span>{" "}
                  {a.action.replace(/_/g, " ")}
                  {a.user ? ` by ${a.user.name}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">{fmtDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

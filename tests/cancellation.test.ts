import { describe, expect, it } from "vitest";
import { cancellationQuote } from "@/lib/subscriptions";

const DAY = 86_400_000;
const now = new Date("2026-10-09T12:00:00Z");
const periodEnd = new Date("2026-10-30T12:00:00Z");
const sub = (over: Partial<Parameters<typeof cancellationQuote>[0]> = {}) => ({
  amount: 99.9,
  currency: "BRL",
  createdAt: new Date(now.getTime() - 30 * DAY),
  currentPeriodEnd: periodEnd,
  status: "active",
  ...over,
});

describe("cancellationQuote", () => {
  it("charges the configured percent of one monthly fee", () => {
    const q = cancellationQuote(sub(), 30, now);
    expect(q.fee).toBe(29.97);
    expect(q.waived).toBeNull();
    expect(q.immediate).toBe(false);
    expect(q.accessUntil).toEqual(periodEnd);
  });

  it("has no fee when the admin set 0%", () => {
    const q = cancellationQuote(sub(), 0, now);
    expect(q.fee).toBe(0);
    expect(q.waived).toBe("none");
  });

  it("waives the fee within the 7-day withdrawal period", () => {
    const q = cancellationQuote(sub({ createdAt: new Date(now.getTime() - 6 * DAY) }), 30, now);
    expect(q.fee).toBe(0);
    expect(q.waived).toBe("withdrawal");
  });

  it("charges after the withdrawal period ends", () => {
    expect(cancellationQuote(sub({ createdAt: new Date(now.getTime() - 7 * DAY) }), 30, now).fee).toBe(29.97);
  });

  it("ends immediately when a payment is pending", () => {
    const q = cancellationQuote(sub({ status: "past_due" }), 0, now);
    expect(q.immediate).toBe(true);
    expect(q.accessUntil).toEqual(now);
  });
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Worker, type NearAccount, parseNEAR } from "near-workspaces";

let worker: Worker;
let contract: NearAccount;
let seller: NearAccount;
let investorA: NearAccount;
let investorB: NearAccount;
let customerC: NearAccount;
let customerD: NearAccount;
let gateway: NearAccount;

const serviceId = "research-api";
const seriesId = "series-001";
const near = (value: string) => BigInt(parseNEAR(value));
const unit = near("0.01");
const advance = near("0.85");
const hash = (character: string) => character.repeat(64);

before(async () => {
  worker = await Worker.init();
  const root = worker.rootAccount;
  [seller, investorA, investorB, customerC, customerD, gateway] = await Promise.all([
    root.createSubAccount("seller", { initialBalance: near("20") }),
    root.createSubAccount("investor-a", { initialBalance: near("20") }),
    root.createSubAccount("investor-b", { initialBalance: near("20") }),
    root.createSubAccount("customer-c", { initialBalance: near("20") }),
    root.createSubAccount("customer-d", { initialBalance: near("20") }),
    root.createSubAccount("gateway", { initialBalance: near("20") }),
  ]);
  const wasm = await readFile(resolve(import.meta.dirname, "../../../artifacts/first100_revenue_rights.wasm"));
  contract = await root.devDeploy(wasm);
  await contract.call(contract, "new", { owner_id: root.accountId, operating_reserve: "0" });
  await seller.call(contract, "register_service", {
    service_id: serviceId,
    gateway: gateway.accountId,
    endpoint_commitment: hash("a"),
  }, { attachedDeposit: near("0.01") });
  await seller.call(contract, "create_series", {
    series_id: seriesId,
    service_id: serviceId,
    cap_n: 2,
    unit_price_yocto: unit.toString(),
    advance_yocto: advance.toString(),
    expires_at_ns: (BigInt(Date.now()) * 1_000_000n + 3_600_000_000_000n).toString(),
    confirmation_timeout_ns: "600000000000",
  }, { attachedDeposit: near("0.02") });
});

after(async () => worker?.tearDown());

async function paidAndDelivered(buyer: NearAccount, nonce: string) {
  const orderId = await buyer.call<string>(contract, "create_order", {
    series_id: seriesId,
    request_hash: hash("b"),
    client_nonce: nonce,
  }, { attachedDeposit: unit });
  const leaseId = `lease-${nonce}`;
  await gateway.call(contract, "acquire_execution_lease", {
    order_id: orderId,
    lease_id: leaseId,
    ttl_ns: "300000000000",
  });
  await gateway.call(contract, "submit_delivery_hash_leased", {
    order_id: orderId,
    response_hash: hash("c"),
    lease_id: leaseId,
  });
  return orderId;
}

test("funds once and mints the right to investor A", async () => {
  await investorA.call(contract, "fund_series", { series_id: seriesId }, { attachedDeposit: advance });
  const token = await contract.view<{ owner_id: string }>("nft_token", { token_id: `right:${seriesId}` });
  assert.equal(token.owner_id, investorA.accountId);
  assert.equal(await contract.view("get_credit", { account_id: seller.accountId }), advance.toString());
  await assert.rejects(
    investorB.call(contract, "fund_series", { series_id: seriesId }, { attachedDeposit: advance }),
    /series is not fundable/,
  );
});

test("settles first buyer payment to investor A", async () => {
  const orderId = await paidAndDelivered(customerC, "customer-c-1");
  await customerC.call(contract, "confirm_delivery", { order_id: orderId, response_hash: hash("c") });
  assert.equal(await contract.view("get_credit", { account_id: investorA.accountId }), unit.toString());
  const order = await contract.view<{ status: string; beneficiary: string }>("get_order", { order_id: orderId });
  assert.equal(order.status, "SETTLED");
  assert.equal(order.beneficiary, investorA.accountId);
});

test("NFT transfer preserves A accrual and routes the next sale to B", async () => {
  await investorA.call(contract, "nft_transfer", {
    receiver_id: investorB.accountId,
    token_id: `right:${seriesId}`,
    approval_id: null,
    memo: "future revenue only",
  }, { attachedDeposit: "1" });
  const orderId = await paidAndDelivered(customerD, "customer-d-1");
  await customerD.call(contract, "confirm_delivery", { order_id: orderId, response_hash: hash("c") });
  assert.equal(await contract.view("get_credit", { account_id: investorA.accountId }), unit.toString());
  assert.equal(await contract.view("get_credit", { account_id: investorB.accountId }), unit.toString());
  const series = await contract.view<{ settled_count: number }>("get_series", { series_id: seriesId });
  assert.equal(series.settled_count, 2);
});

test("sale beyond N goes to the seller", async () => {
  const orderId = await paidAndDelivered(customerC, "customer-c-3");
  await customerC.call(contract, "confirm_delivery", { order_id: orderId, response_hash: hash("c") });
  assert.equal(await contract.view("get_credit", { account_id: seller.accountId }), (advance + unit).toString());
});

test("audit totals reconcile credits and escrow", async () => {
  const audit = await contract.view<{
    total_credits: string;
    active_order_escrow: string;
    in_flight_withdrawals: string;
    total_liabilities: string;
  }>("audit_totals", {});
  assert.equal(
    BigInt(audit.total_liabilities),
    BigInt(audit.total_credits) + BigInt(audit.active_order_escrow) + BigInt(audit.in_flight_withdrawals),
  );
});

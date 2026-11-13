use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{U128, U64};
use near_sdk::{AccountId, BorshStorageKey};
use serde::{Deserialize, Serialize};

pub type ServiceId = String;
pub type SeriesId = String;
pub type OrderId = String;
pub type TokenId = String;
pub type WithdrawalId = u64;

#[derive(BorshSerialize, BorshStorageKey)]
pub enum StorageKey {
    Services,
    Series,
    Orders,
    Nonces,
    Credits,
    Withdrawals,
    ActiveSeries,
    OpenOrders,
    PendingTransfers,
    Nft,
    NftMetadata,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct Service {
    pub id: ServiceId,
    pub operator: AccountId,
    pub gateway: AccountId,
    pub endpoint_commitment: String,
    pub is_active: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SeriesStatus {
    Listed,
    Funded,
    Cancelled,
    Closed,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
pub struct RevenueSeries {
    pub id: SeriesId,
    pub service_id: ServiceId,
    pub seller: AccountId,
    pub beneficiary_token_id: TokenId,
    pub cap_n: u32,
    pub settled_count: u32,
    pub unit_price_yocto: u128,
    pub advance_yocto: u128,
    pub expires_at_ns: u64,
    pub confirmation_timeout_ns: u64,
    pub status: SeriesStatus,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct RevenueSeriesView {
    pub id: SeriesId,
    pub service_id: ServiceId,
    pub seller: AccountId,
    pub beneficiary_token_id: TokenId,
    pub cap_n: u32,
    pub settled_count: u32,
    pub unit_price_yocto: U128,
    pub advance_yocto: U128,
    pub expires_at_ns: U64,
    pub confirmation_timeout_ns: U64,
    pub status: SeriesStatus,
    pub entitlement_complete: bool,
}

impl From<RevenueSeries> for RevenueSeriesView {
    fn from(value: RevenueSeries) -> Self {
        let entitlement_complete = value.settled_count >= value.cap_n;
        Self {
            id: value.id,
            service_id: value.service_id,
            seller: value.seller,
            beneficiary_token_id: value.beneficiary_token_id,
            cap_n: value.cap_n,
            settled_count: value.settled_count,
            unit_price_yocto: U128(value.unit_price_yocto),
            advance_yocto: U128(value.advance_yocto),
            expires_at_ns: U64(value.expires_at_ns),
            confirmation_timeout_ns: U64(value.confirmation_timeout_ns),
            status: value.status,
            entitlement_complete,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderStatus {
    PaidPending,
    Delivered,
    Settled,
    Refunded,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
pub struct ApiOrder {
    pub id: OrderId,
    pub series_id: SeriesId,
    pub buyer: AccountId,
    pub request_hash: String,
    pub response_hash: Option<String>,
    pub amount_yocto: u128,
    pub created_ns: u64,
    pub confirm_deadline_ns: u64,
    pub status: OrderStatus,
    pub beneficiary: Option<AccountId>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct ApiOrderView {
    pub id: OrderId,
    pub series_id: SeriesId,
    pub buyer: AccountId,
    pub request_hash: String,
    pub response_hash: Option<String>,
    pub amount_yocto: U128,
    pub created_ns: U64,
    pub confirm_deadline_ns: U64,
    pub status: OrderStatus,
    pub beneficiary: Option<AccountId>,
}

impl From<ApiOrder> for ApiOrderView {
    fn from(value: ApiOrder) -> Self {
        Self {
            id: value.id,
            series_id: value.series_id,
            buyer: value.buyer,
            request_hash: value.request_hash,
            response_hash: value.response_hash,
            amount_yocto: U128(value.amount_yocto),
            created_ns: U64(value.created_ns),
            confirm_deadline_ns: U64(value.confirm_deadline_ns),
            status: value.status,
            beneficiary: value.beneficiary,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WithdrawalStatus {
    InFlight,
    Completed,
    Restored,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Withdrawal {
    pub id: WithdrawalId,
    pub owner: AccountId,
    pub amount_yocto: u128,
    pub status: WithdrawalStatus,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct WithdrawalView {
    pub id: WithdrawalId,
    pub owner: AccountId,
    pub amount_yocto: U128,
    pub status: WithdrawalStatus,
}

impl From<Withdrawal> for WithdrawalView {
    fn from(value: Withdrawal) -> Self {
        Self {
            id: value.id,
            owner: value.owner,
            amount_yocto: U128(value.amount_yocto),
            status: value.status,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct AuditTotals {
    pub total_credits: U128,
    pub active_order_escrow: U128,
    pub in_flight_withdrawals: U128,
    pub total_liabilities: U128,
    pub total_funded_advances: U128,
    pub total_settled_revenue: U128,
    pub total_refunds: U128,
    pub contract_balance: U128,
    pub storage_locked: U128,
    pub operating_reserve: U128,
    pub solvent: bool,
}

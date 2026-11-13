use near_sdk::{env, AccountId};
use serde::Serialize;

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct EventEnvelope<'a, T: Serialize> {
    standard: &'static str,
    version: &'static str,
    event: &'a str,
    data: &'a [T],
}

pub fn emit<T: Serialize>(event: &str, data: T) {
    let envelope = EventEnvelope {
        standard: "first100",
        version: "1.0.0",
        event,
        data: &[data],
    };
    env::log_str(&format!(
        "EVENT_JSON:{}",
        near_sdk::serde_json::to_string(&envelope).expect("event serialization must succeed")
    ));
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ServiceRegistered<'a> {
    pub service_id: &'a str,
    pub operator: &'a AccountId,
    pub gateway: &'a AccountId,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SeriesEvent<'a> {
    pub series_id: &'a str,
    pub service_id: &'a str,
    pub actor: &'a AccountId,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AmountEvent<'a> {
    pub series_id: &'a str,
    pub account_id: &'a AccountId,
    pub amount_yocto: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OrderEvent<'a> {
    pub order_id: &'a str,
    pub series_id: &'a str,
    pub buyer: &'a AccountId,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct RefundEvent<'a> {
    pub order_id: &'a str,
    pub series_id: &'a str,
    pub buyer: &'a AccountId,
    pub amount_yocto: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct DeliveryEvent<'a> {
    pub order_id: &'a str,
    pub response_hash: &'a str,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct RevenueEvent<'a> {
    pub order_id: &'a str,
    pub series_id: &'a str,
    pub beneficiary: &'a AccountId,
    pub amount_yocto: String,
    pub settled_count: u32,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct WithdrawalEvent<'a> {
    pub withdrawal_id: u64,
    pub owner: &'a AccountId,
    pub amount_yocto: String,
}

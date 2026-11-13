use crate::events::{
    self, AmountEvent, DeliveryEvent, OrderEvent, RefundEvent, RevenueEvent, SeriesEvent,
    ServiceRegistered, WithdrawalEvent,
};
use crate::models::*;
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_contract_standards::non_fungible_token::NonFungibleToken;
use near_sdk::collections::LookupMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, NearToken, PanicOnDefault, Promise,
};

const SERVICE_STORAGE_DEPOSIT: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR
const SERIES_STORAGE_DEPOSIT: u128 = 20_000_000_000_000_000_000_000; // 0.02 NEAR
const DEFAULT_OPERATING_RESERVE: u128 = 200_000_000_000_000_000_000_000; // 0.2 NEAR
const MIN_CONFIRM_TIMEOUT_NS: u64 = 60_000_000_000;
const MAX_CONFIRM_TIMEOUT_NS: u64 = 7 * 24 * 60 * 60 * 1_000_000_000;
const MAX_CAP: u32 = 10_000;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub(crate) owner_id: AccountId,
    pub(crate) services: LookupMap<ServiceId, Service>,
    pub(crate) series: LookupMap<SeriesId, RevenueSeries>,
    pub(crate) orders: LookupMap<OrderId, ApiOrder>,
    pub(crate) used_nonces: LookupMap<Vec<u8>, bool>,
    pub(crate) credits: LookupMap<AccountId, u128>,
    pub(crate) withdrawals: LookupMap<WithdrawalId, Withdrawal>,
    pub(crate) active_series_by_service: LookupMap<ServiceId, SeriesId>,
    pub(crate) open_orders_by_series: LookupMap<SeriesId, u32>,
    pub(crate) pending_transfers: LookupMap<TokenId, bool>,
    pub(crate) tokens: NonFungibleToken,
    pub(crate) next_withdrawal_id: WithdrawalId,
    pub(crate) total_credits: u128,
    pub(crate) total_order_escrow: u128,
    pub(crate) total_in_flight: u128,
    pub(crate) total_funded_advances: u128,
    pub(crate) total_settled_revenue: u128,
    pub(crate) total_refunds: u128,
    pub(crate) operating_reserve: u128,
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, AccountId, PromiseResult};

    const NOW: u64 = 1_000_000_000_000;
    const UNIT: u128 = 100;
    const ADVANCE: u128 = 850;

    fn account(id: &str) -> AccountId {
        id.parse().unwrap()
    }

    fn hash(ch: char) -> String {
        ch.to_string().repeat(64)
    }

    fn set_context(predecessor: &str, deposit: u128, timestamp: u64) {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("first100.test.near"))
            .signer_account_id(account(predecessor))
            .predecessor_account_id(account(predecessor))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .account_balance(NearToken::from_near(100))
            .block_timestamp(timestamp);
        testing_env!(builder.build());
    }

    fn blank() -> Contract {
        set_context("owner.test.near", 0, NOW);
        Contract::new(account("owner.test.near"), Some(U128(0)))
    }

    fn with_service() -> Contract {
        let mut contract = blank();
        set_context("seller.test.near", SERVICE_STORAGE_DEPOSIT, NOW);
        contract.register_service(
            "research-api".to_string(),
            account("gateway.test.near"),
            hash('a'),
        );
        contract
    }

    fn listed(cap: u32) -> Contract {
        let mut contract = with_service();
        set_context("seller.test.near", SERIES_STORAGE_DEPOSIT, NOW);
        contract.create_series(
            "series-001".to_string(),
            "research-api".to_string(),
            cap,
            U128(UNIT),
            U128(ADVANCE),
            U64(NOW + 10_000_000_000_000),
            U64(MIN_CONFIRM_TIMEOUT_NS),
        );
        contract
    }

    fn funded(cap: u32) -> Contract {
        let mut contract = listed(cap);
        set_context("investor.test.near", ADVANCE, NOW + 1);
        contract.fund_series("series-001".to_string());
        contract
    }

    fn paid_order(contract: &mut Contract, buyer: &str, nonce: &str, now: u64) -> String {
        set_context(buyer, UNIT, now);
        contract.create_order("series-001".to_string(), hash('b'), nonce.to_string())
    }

    fn delivered_order(contract: &mut Contract, buyer: &str, nonce: &str, now: u64) -> String {
        let id = paid_order(contract, buyer, nonce, now);
        set_context("gateway.test.near", 0, now + 1);
        contract.submit_delivery_hash(id.clone(), hash('c'));
        id
    }

    fn settle(contract: &mut Contract, buyer: &str, nonce: &str, now: u64) -> String {
        let id = delivered_order(contract, buyer, nonce, now);
        set_context(buyer, 0, now + 2);
        contract.confirm_delivery(id.clone(), hash('c'));
        id
    }

    #[test]
    fn registers_service() {
        let contract = with_service();
        let service = contract.get_service("research-api".to_string()).unwrap();
        assert_eq!(service.operator, account("seller.test.near"));
        assert!(service.is_active);
    }

    #[test]
    #[should_panic(expected = "service_id already exists")]
    fn rejects_duplicate_service() {
        let mut contract = with_service();
        set_context("seller.test.near", SERVICE_STORAGE_DEPOSIT, NOW);
        contract.register_service(
            "research-api".to_string(),
            account("gateway.test.near"),
            hash('a'),
        );
    }

    #[test]
    #[should_panic(expected = "64-character hex")]
    fn rejects_invalid_endpoint_hash() {
        let mut contract = blank();
        set_context("seller.test.near", SERVICE_STORAGE_DEPOSIT, NOW);
        contract.register_service(
            "service".to_string(),
            account("gateway.test.near"),
            "bad".into(),
        );
    }

    #[test]
    fn lists_series_without_minting() {
        let contract = listed(100);
        let series = contract.get_series("series-001".into()).unwrap();
        assert_eq!(series.status, SeriesStatus::Listed);
        assert!(contract
            .tokens
            .owner_by_id
            .get(&series.beneficiary_token_id)
            .is_none());
    }

    #[test]
    #[should_panic(expected = "operator only")]
    fn rejects_non_operator_series() {
        let mut contract = with_service();
        set_context("attacker.test.near", SERIES_STORAGE_DEPOSIT, NOW);
        contract.create_series(
            "series-x".into(),
            "research-api".into(),
            1,
            U128(UNIT),
            U128(ADVANCE),
            U64(NOW + 1_000_000_000_000),
            U64(MIN_CONFIRM_TIMEOUT_NS),
        );
    }

    #[test]
    #[should_panic(expected = "cap_n out of range")]
    fn rejects_zero_cap() {
        let _ = listed(0);
    }

    #[test]
    fn funding_mints_nft_and_credits_seller() {
        let contract = funded(100);
        let token = contract
            .tokens
            .nft_token("right:series-001".into())
            .unwrap();
        assert_eq!(token.owner_id, account("investor.test.near"));
        assert_eq!(
            contract.get_credit(account("seller.test.near")),
            U128(ADVANCE)
        );
        assert_eq!(contract.audit_totals().total_funded_advances, U128(ADVANCE));
    }

    #[test]
    #[should_panic(expected = "series is not fundable")]
    fn rejects_second_funding() {
        let mut contract = funded(100);
        set_context("other.test.near", ADVANCE, NOW + 2);
        contract.fund_series("series-001".into());
    }

    #[test]
    #[should_panic(expected = "active funded series")]
    fn rejects_overlapping_funded_series() {
        let mut contract = funded(100);
        set_context("seller.test.near", SERIES_STORAGE_DEPOSIT, NOW + 2);
        contract.create_series(
            "series-002".into(),
            "research-api".into(),
            10,
            U128(UNIT),
            U128(ADVANCE),
            U64(NOW + 10_000_000_000_000),
            U64(MIN_CONFIRM_TIMEOUT_NS),
        );
        set_context("other.test.near", ADVANCE, NOW + 3);
        contract.fund_series("series-002".into());
    }

    #[test]
    fn paid_order_enters_escrow() {
        let mut contract = funded(100);
        let id = paid_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        assert_eq!(
            contract.get_order(id).unwrap().status,
            OrderStatus::PaidPending
        );
        assert_eq!(contract.audit_totals().active_order_escrow, U128(UNIT));
        assert_eq!(contract.get_open_order_count("series-001".into()), 1);
    }

    #[test]
    #[should_panic(expected = "buyer nonce already used")]
    fn rejects_nonce_replay() {
        let mut contract = funded(100);
        paid_order(&mut contract, "buyer.test.near", "same", NOW + 2);
        paid_order(&mut contract, "buyer.test.near", "same", NOW + 3);
    }

    #[test]
    #[should_panic(expected = "gateway or operator only")]
    fn rejects_unauthorized_delivery() {
        let mut contract = funded(100);
        let id = paid_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        set_context("attacker.test.near", 0, NOW + 3);
        contract.submit_delivery_hash(id, hash('c'));
    }

    #[test]
    fn gateway_marks_delivery() {
        let mut contract = funded(100);
        let id = delivered_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        let order = contract.get_order(id).unwrap();
        assert_eq!(order.status, OrderStatus::Delivered);
        assert_eq!(order.response_hash, Some(hash('c')));
    }

    #[test]
    #[should_panic(expected = "buyer only")]
    fn rejects_other_buyer_confirmation() {
        let mut contract = funded(100);
        let id = delivered_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        set_context("attacker.test.near", 0, NOW + 4);
        contract.confirm_delivery(id, hash('c'));
    }

    #[test]
    #[should_panic(expected = "response hash mismatch")]
    fn rejects_response_hash_mismatch() {
        let mut contract = funded(100);
        let id = delivered_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        set_context("buyer.test.near", 0, NOW + 4);
        contract.confirm_delivery(id, hash('d'));
    }

    #[test]
    fn settlement_credits_current_holder() {
        let mut contract = funded(100);
        let id = settle(&mut contract, "buyer.test.near", "n1", NOW + 2);
        assert_eq!(
            contract.get_credit(account("investor.test.near")),
            U128(UNIT)
        );
        assert_eq!(contract.get_order(id).unwrap().status, OrderStatus::Settled);
        assert_eq!(
            contract
                .get_series("series-001".into())
                .unwrap()
                .settled_count,
            1
        );
        assert_eq!(contract.audit_totals().active_order_escrow, U128(0));
    }

    #[test]
    #[should_panic(expected = "order is not delivered")]
    fn rejects_double_confirmation() {
        let mut contract = funded(100);
        let id = settle(&mut contract, "buyer.test.near", "n1", NOW + 2);
        set_context("buyer.test.near", 0, NOW + 5);
        contract.confirm_delivery(id, hash('c'));
    }

    #[test]
    fn transfer_changes_only_future_revenue() {
        let mut contract = funded(100);
        settle(&mut contract, "buyer.test.near", "n1", NOW + 2);
        set_context("investor.test.near", 1, NOW + 5);
        contract.nft_transfer(
            account("new-holder.test.near"),
            "right:series-001".into(),
            None,
            None,
        );
        settle(&mut contract, "buyer2.test.near", "n2", NOW + 6);
        assert_eq!(
            contract.get_credit(account("investor.test.near")),
            U128(UNIT)
        );
        assert_eq!(
            contract.get_credit(account("new-holder.test.near")),
            U128(UNIT)
        );
    }

    #[test]
    fn cap_routes_later_revenue_to_seller() {
        let mut contract = funded(1);
        settle(&mut contract, "buyer.test.near", "n1", NOW + 2);
        settle(&mut contract, "buyer2.test.near", "n2", NOW + 5);
        assert_eq!(
            contract.get_credit(account("investor.test.near")),
            U128(UNIT)
        );
        assert_eq!(
            contract.get_credit(account("seller.test.near")),
            U128(ADVANCE + UNIT)
        );
        assert_eq!(
            contract
                .get_series("series-001".into())
                .unwrap()
                .settled_count,
            1
        );
    }

    #[test]
    #[should_panic(expected = "refund is not available yet")]
    fn rejects_early_refund() {
        let mut contract = funded(100);
        let id = paid_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        set_context("buyer.test.near", 0, NOW + 3);
        contract.claim_refund(id);
    }

    #[test]
    fn timeout_refund_restores_buyer_credit() {
        let mut contract = funded(100);
        let created = NOW + 2;
        let id = paid_order(&mut contract, "buyer.test.near", "n1", created);
        set_context("buyer.test.near", 0, created + MIN_CONFIRM_TIMEOUT_NS + 1);
        contract.claim_refund(id.clone());
        assert_eq!(
            contract.get_order(id).unwrap().status,
            OrderStatus::Refunded
        );
        assert_eq!(contract.get_credit(account("buyer.test.near")), U128(UNIT));
        assert_eq!(contract.audit_totals().total_refunds, U128(UNIT));
    }

    #[test]
    #[should_panic(expected = "order is terminal")]
    fn refunded_order_cannot_refund_twice() {
        let mut contract = funded(100);
        let created = NOW + 2;
        let id = paid_order(&mut contract, "buyer.test.near", "n1", created);
        set_context("buyer.test.near", 0, created + MIN_CONFIRM_TIMEOUT_NS + 1);
        contract.claim_refund(id.clone());
        contract.claim_refund(id);
    }

    #[test]
    fn seller_can_cancel_unfunded_listing() {
        let mut contract = listed(100);
        set_context("seller.test.near", 0, NOW + 2);
        contract.cancel_unfunded_series("series-001".into());
        assert_eq!(
            contract.get_series("series-001".into()).unwrap().status,
            SeriesStatus::Cancelled
        );
    }

    #[test]
    #[should_panic(expected = "only listed series")]
    fn seller_cannot_cancel_funded_series() {
        let mut contract = funded(100);
        set_context("seller.test.near", 0, NOW + 2);
        contract.cancel_unfunded_series("series-001".into());
    }

    #[test]
    #[should_panic(expected = "orders remain open")]
    fn cannot_close_expired_series_with_open_order() {
        let mut contract = funded(100);
        paid_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        set_context("anyone.test.near", 0, NOW + 10_000_000_000_001);
        contract.close_expired_series("series-001".into());
    }

    #[test]
    fn expired_resolved_series_releases_service_lock() {
        let mut contract = funded(100);
        let created = NOW + 2;
        let id = paid_order(&mut contract, "buyer.test.near", "n1", created);
        set_context("buyer.test.near", 0, created + MIN_CONFIRM_TIMEOUT_NS + 1);
        contract.claim_refund(id);
        set_context("anyone.test.near", 0, NOW + 10_000_000_000_001);
        contract.close_expired_series("series-001".into());
        assert_eq!(
            contract.get_series("series-001".into()).unwrap().status,
            SeriesStatus::Closed
        );
        assert_eq!(contract.get_active_series("research-api".into()), None);
    }

    #[test]
    #[should_panic(expected = "insufficient credit")]
    fn rejects_withdraw_above_credit() {
        let mut contract = funded(100);
        set_context("seller.test.near", 1, NOW + 2);
        let _ = contract.withdraw(Some(U128(ADVANCE + 1)));
    }

    #[test]
    fn withdraw_moves_credit_to_in_flight() {
        let mut contract = funded(100);
        set_context("seller.test.near", 1, NOW + 2);
        let _ = contract.withdraw(Some(U128(100)));
        assert_eq!(
            contract.get_credit(account("seller.test.near")),
            U128(ADVANCE - 100)
        );
        assert_eq!(contract.audit_totals().in_flight_withdrawals, U128(100));
        assert_eq!(
            contract.get_withdrawal(0).unwrap().status,
            WithdrawalStatus::InFlight
        );
    }

    #[test]
    fn failed_withdrawal_restores_credit_once() {
        let mut contract = funded(100);
        set_context("seller.test.near", 1, NOW + 2);
        let _ = contract.withdraw(Some(U128(100)));

        let mut callback = VMContextBuilder::new();
        callback
            .current_account_id(account("first100.test.near"))
            .signer_account_id(account("first100.test.near"))
            .predecessor_account_id(account("first100.test.near"))
            .account_balance(NearToken::from_near(100));
        testing_env!(
            callback.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::<String, NearToken>::default(),
            vec![PromiseResult::Failed],
        );

        assert!(!contract.on_withdraw_complete(0));
        assert_eq!(
            contract.get_credit(account("seller.test.near")),
            U128(ADVANCE)
        );
        assert_eq!(contract.audit_totals().in_flight_withdrawals, U128(0));
        assert_eq!(
            contract.get_withdrawal(0).unwrap().status,
            WithdrawalStatus::Restored
        );
    }

    #[test]
    #[should_panic(expected = "revenue-right transfer is pending")]
    fn pending_transfer_blocks_settlement() {
        let mut contract = funded(100);
        let id = delivered_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        contract
            .pending_transfers
            .insert(&"right:series-001".to_string(), &true);
        set_context("buyer.test.near", 0, NOW + 4);
        contract.confirm_delivery(id, hash('c'));
    }

    #[test]
    fn audit_totals_match_liability_components() {
        let mut contract = funded(100);
        paid_order(&mut contract, "buyer.test.near", "n1", NOW + 2);
        let audit = contract.audit_totals();
        assert_eq!(audit.total_credits, U128(ADVANCE));
        assert_eq!(audit.active_order_escrow, U128(UNIT));
        assert_eq!(audit.total_liabilities, U128(ADVANCE + UNIT));
    }
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, operating_reserve: Option<U128>) -> Self {
        let reserve = operating_reserve
            .map(|value| value.0)
            .unwrap_or(DEFAULT_OPERATING_RESERVE);
        Self {
            owner_id: owner_id.clone(),
            services: LookupMap::new(StorageKey::Services),
            series: LookupMap::new(StorageKey::Series),
            orders: LookupMap::new(StorageKey::Orders),
            used_nonces: LookupMap::new(StorageKey::Nonces),
            credits: LookupMap::new(StorageKey::Credits),
            withdrawals: LookupMap::new(StorageKey::Withdrawals),
            active_series_by_service: LookupMap::new(StorageKey::ActiveSeries),
            open_orders_by_series: LookupMap::new(StorageKey::OpenOrders),
            pending_transfers: LookupMap::new(StorageKey::PendingTransfers),
            tokens: NonFungibleToken::new(
                StorageKey::Nft,
                owner_id,
                Some(StorageKey::NftMetadata),
                None::<StorageKey>,
                None::<StorageKey>,
            ),
            next_withdrawal_id: 0,
            total_credits: 0,
            total_order_escrow: 0,
            total_in_flight: 0,
            total_funded_advances: 0,
            total_settled_revenue: 0,
            total_refunds: 0,
            operating_reserve: reserve,
        }
    }

    #[payable]
    pub fn register_service(
        &mut self,
        service_id: ServiceId,
        gateway: AccountId,
        endpoint_commitment: String,
    ) -> Service {
        Self::assert_exact_deposit(SERVICE_STORAGE_DEPOSIT, "service storage deposit");
        Self::assert_identifier(&service_id, "service_id");
        Self::assert_hash(&endpoint_commitment, "endpoint_commitment");
        require!(
            self.services.get(&service_id).is_none(),
            "service_id already exists"
        );

        let operator = env::predecessor_account_id();
        let service = Service {
            id: service_id.clone(),
            operator: operator.clone(),
            gateway: gateway.clone(),
            endpoint_commitment,
            is_active: true,
        };
        self.services.insert(&service_id, &service);
        events::emit(
            "service_registered",
            ServiceRegistered {
                service_id: &service_id,
                operator: &operator,
                gateway: &gateway,
            },
        );
        service
    }

    pub fn set_service_active(&mut self, service_id: ServiceId, is_active: bool) {
        let mut service = self.services.get(&service_id).expect("service not found");
        require!(
            service.operator == env::predecessor_account_id(),
            "operator only"
        );
        service.is_active = is_active;
        self.services.insert(&service_id, &service);
    }

    #[payable]
    pub fn create_series(
        &mut self,
        series_id: SeriesId,
        service_id: ServiceId,
        cap_n: u32,
        unit_price_yocto: U128,
        advance_yocto: U128,
        expires_at_ns: U64,
        confirmation_timeout_ns: U64,
    ) -> RevenueSeriesView {
        Self::assert_exact_deposit(SERIES_STORAGE_DEPOSIT, "series storage deposit");
        Self::assert_identifier(&series_id, "series_id");
        require!(
            self.series.get(&series_id).is_none(),
            "series_id already exists"
        );
        require!(cap_n > 0 && cap_n <= MAX_CAP, "cap_n out of range");
        require!(unit_price_yocto.0 > 0, "unit price must be positive");
        require!(advance_yocto.0 > 0, "advance must be positive");
        require!(
            expires_at_ns.0 > env::block_timestamp(),
            "expiry must be in the future"
        );
        require!(
            (MIN_CONFIRM_TIMEOUT_NS..=MAX_CONFIRM_TIMEOUT_NS).contains(&confirmation_timeout_ns.0),
            "confirmation timeout out of range"
        );

        let service = self.services.get(&service_id).expect("service not found");
        let seller = env::predecessor_account_id();
        require!(service.operator == seller, "operator only");
        require!(service.is_active, "service is inactive");

        let series = RevenueSeries {
            id: series_id.clone(),
            service_id: service_id.clone(),
            seller: seller.clone(),
            beneficiary_token_id: Self::token_id_for(&series_id),
            cap_n,
            settled_count: 0,
            unit_price_yocto: unit_price_yocto.0,
            advance_yocto: advance_yocto.0,
            expires_at_ns: expires_at_ns.0,
            confirmation_timeout_ns: confirmation_timeout_ns.0,
            status: SeriesStatus::Listed,
        };
        self.series.insert(&series_id, &series);
        self.open_orders_by_series.insert(&series_id, &0);
        events::emit(
            "series_listed",
            SeriesEvent {
                series_id: &series_id,
                service_id: &service_id,
                actor: &seller,
            },
        );
        series.into()
    }

    pub fn cancel_unfunded_series(&mut self, series_id: SeriesId) {
        let mut series = self.series.get(&series_id).expect("series not found");
        require!(
            series.seller == env::predecessor_account_id(),
            "seller only"
        );
        require!(
            series.status == SeriesStatus::Listed,
            "only listed series can be cancelled"
        );
        series.status = SeriesStatus::Cancelled;
        self.series.insert(&series_id, &series);
        events::emit(
            "series_cancelled",
            SeriesEvent {
                series_id: &series_id,
                service_id: &series.service_id,
                actor: &series.seller,
            },
        );
    }

    #[payable]
    pub fn fund_series(&mut self, series_id: SeriesId) {
        let mut series = self.series.get(&series_id).expect("series not found");
        require!(
            series.status == SeriesStatus::Listed,
            "series is not fundable"
        );
        require!(
            env::block_timestamp() < series.expires_at_ns,
            "series expired"
        );
        Self::assert_exact_deposit(series.advance_yocto, "advance");
        require!(
            self.active_series_by_service
                .get(&series.service_id)
                .is_none(),
            "service already has an active funded series"
        );

        let investor = env::predecessor_account_id();
        series.status = SeriesStatus::Funded;
        self.series.insert(&series_id, &series);
        self.active_series_by_service
            .insert(&series.service_id, &series_id);
        self.add_credit(&series.seller, series.advance_yocto);
        self.total_funded_advances = self
            .total_funded_advances
            .checked_add(series.advance_yocto)
            .expect("funded total overflow");

        let metadata = TokenMetadata {
            title: Some(format!("FIRST100 Revenue Right — {}", series_id)),
            description: Some(format!(
                "Right to the next {} buyer-confirmed sales for service {}. Prior accruals do not transfer.",
                series.cap_n, series.service_id
            )),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp().to_string()),
            expires_at: Some(series.expires_at_ns.to_string()),
            starts_at: None,
            updated_at: None,
            extra: Some(format!(
                "{{\"series_id\":\"{}\",\"cap_n\":{},\"unit_price_yocto\":\"{}\"}}",
                series.id, series.cap_n, series.unit_price_yocto
            )),
            reference: None,
            reference_hash: None,
        };
        self.tokens.internal_mint_with_refund(
            series.beneficiary_token_id.clone(),
            investor.clone(),
            Some(metadata),
            None,
        );
        NftMint {
            owner_id: &investor,
            token_ids: &[&series.beneficiary_token_id],
            memo: Some("FIRST100 revenue right funded"),
        }
        .emit();
        events::emit(
            "series_funded",
            AmountEvent {
                series_id: &series_id,
                account_id: &investor,
                amount_yocto: series.advance_yocto.to_string(),
            },
        );
    }

    #[payable]
    pub fn create_order(
        &mut self,
        series_id: SeriesId,
        request_hash: String,
        client_nonce: String,
    ) -> OrderId {
        Self::assert_hash(&request_hash, "request_hash");
        Self::assert_identifier(&client_nonce, "client_nonce");
        let series = self.series.get(&series_id).expect("series not found");
        require!(
            series.status == SeriesStatus::Funded,
            "series is not funded"
        );
        require!(
            env::block_timestamp() < series.expires_at_ns,
            "series expired"
        );
        Self::assert_exact_deposit(series.unit_price_yocto, "unit price");
        let service = self
            .services
            .get(&series.service_id)
            .expect("service not found");
        require!(service.is_active, "service is inactive");

        let buyer = env::predecessor_account_id();
        let nonce_key = Self::nonce_key(&buyer, &series_id, &client_nonce);
        require!(
            self.used_nonces.get(&nonce_key).is_none(),
            "buyer nonce already used"
        );
        let order_id = Self::hash_hex(&nonce_key);
        require!(self.orders.get(&order_id).is_none(), "order id collision");
        self.used_nonces.insert(&nonce_key, &true);

        let now = env::block_timestamp();
        let order = ApiOrder {
            id: order_id.clone(),
            series_id: series_id.clone(),
            buyer: buyer.clone(),
            request_hash,
            response_hash: None,
            amount_yocto: series.unit_price_yocto,
            created_ns: now,
            confirm_deadline_ns: now
                .checked_add(series.confirmation_timeout_ns)
                .expect("deadline overflow"),
            status: OrderStatus::PaidPending,
            beneficiary: None,
        };
        self.orders.insert(&order_id, &order);
        self.total_order_escrow = self
            .total_order_escrow
            .checked_add(order.amount_yocto)
            .expect("escrow overflow");
        let open = self.open_orders_by_series.get(&series_id).unwrap_or(0);
        self.open_orders_by_series.insert(
            &series_id,
            &open.checked_add(1).expect("open order count overflow"),
        );
        events::emit(
            "order_paid",
            OrderEvent {
                order_id: &order_id,
                series_id: &series_id,
                buyer: &buyer,
            },
        );
        order_id
    }

    pub fn submit_delivery_hash(&mut self, order_id: OrderId, response_hash: String) {
        Self::assert_hash(&response_hash, "response_hash");
        let mut order = self.orders.get(&order_id).expect("order not found");
        require!(
            order.status == OrderStatus::PaidPending,
            "order is not awaiting delivery"
        );
        require!(
            env::block_timestamp() <= order.confirm_deadline_ns,
            "confirmation deadline passed"
        );
        let series = self.series.get(&order.series_id).expect("series not found");
        let service = self
            .services
            .get(&series.service_id)
            .expect("service not found");
        let caller = env::predecessor_account_id();
        require!(
            caller == service.gateway || caller == service.operator,
            "gateway or operator only"
        );
        order.response_hash = Some(response_hash.clone());
        order.status = OrderStatus::Delivered;
        self.orders.insert(&order_id, &order);
        events::emit(
            "delivery_submitted",
            DeliveryEvent {
                order_id: &order_id,
                response_hash: &response_hash,
            },
        );
    }

    pub fn confirm_delivery(&mut self, order_id: OrderId, response_hash: String) {
        let mut order = self.orders.get(&order_id).expect("order not found");
        require!(order.buyer == env::predecessor_account_id(), "buyer only");
        require!(
            order.status == OrderStatus::Delivered,
            "order is not delivered"
        );
        require!(
            env::block_timestamp() <= order.confirm_deadline_ns,
            "confirmation deadline passed"
        );
        require!(
            order.response_hash.as_ref() == Some(&response_hash),
            "response hash mismatch"
        );

        let mut series = self.series.get(&order.series_id).expect("series not found");
        require!(
            series.status == SeriesStatus::Funded,
            "series is not active"
        );
        require!(
            self.pending_transfers
                .get(&series.beneficiary_token_id)
                .is_none(),
            "revenue-right transfer is pending"
        );

        let beneficiary = if series.settled_count < series.cap_n {
            let owner = self
                .tokens
                .owner_by_id
                .get(&series.beneficiary_token_id)
                .expect("revenue-right NFT missing");
            series.settled_count = series.settled_count.checked_add(1).expect("count overflow");
            owner
        } else {
            series.seller.clone()
        };

        order.status = OrderStatus::Settled;
        order.beneficiary = Some(beneficiary.clone());
        self.orders.insert(&order_id, &order);
        self.series.insert(&series.id, &series);
        self.close_open_order(&series.id);
        self.total_order_escrow = self
            .total_order_escrow
            .checked_sub(order.amount_yocto)
            .expect("escrow underflow");
        self.total_settled_revenue = self
            .total_settled_revenue
            .checked_add(order.amount_yocto)
            .expect("revenue overflow");
        self.add_credit(&beneficiary, order.amount_yocto);
        events::emit(
            "revenue_accrued",
            RevenueEvent {
                order_id: &order_id,
                series_id: &series.id,
                beneficiary: &beneficiary,
                amount_yocto: order.amount_yocto.to_string(),
                settled_count: series.settled_count,
            },
        );
    }

    pub fn claim_refund(&mut self, order_id: OrderId) {
        let mut order = self.orders.get(&order_id).expect("order not found");
        require!(order.buyer == env::predecessor_account_id(), "buyer only");
        require!(
            matches!(
                order.status,
                OrderStatus::PaidPending | OrderStatus::Delivered
            ),
            "order is terminal"
        );
        require!(
            env::block_timestamp() > order.confirm_deadline_ns,
            "refund is not available yet"
        );
        order.status = OrderStatus::Refunded;
        self.orders.insert(&order_id, &order);
        self.close_open_order(&order.series_id);
        self.total_order_escrow = self
            .total_order_escrow
            .checked_sub(order.amount_yocto)
            .expect("escrow underflow");
        self.total_refunds = self
            .total_refunds
            .checked_add(order.amount_yocto)
            .expect("refund total overflow");
        self.add_credit(&order.buyer, order.amount_yocto);
        events::emit(
            "order_refunded",
            RefundEvent {
                order_id: &order_id,
                series_id: &order.series_id,
                buyer: &order.buyer,
                amount_yocto: order.amount_yocto.to_string(),
            },
        );
    }

    pub fn close_expired_series(&mut self, series_id: SeriesId) {
        let mut series = self.series.get(&series_id).expect("series not found");
        require!(
            series.status == SeriesStatus::Funded,
            "series is not funded"
        );
        require!(
            env::block_timestamp() >= series.expires_at_ns,
            "series is not expired"
        );
        require!(
            self.open_orders_by_series.get(&series_id).unwrap_or(0) == 0,
            "orders remain open"
        );
        series.status = SeriesStatus::Closed;
        self.series.insert(&series_id, &series);
        if self.active_series_by_service.get(&series.service_id) == Some(series_id.clone()) {
            self.active_series_by_service.remove(&series.service_id);
        }
        events::emit(
            "series_closed",
            SeriesEvent {
                series_id: &series_id,
                service_id: &series.service_id,
                actor: &env::predecessor_account_id(),
            },
        );
    }

    #[payable]
    pub fn withdraw(&mut self, amount: Option<U128>) -> Promise {
        assert_one_yocto();
        let owner = env::predecessor_account_id();
        let available = self.credits.get(&owner).unwrap_or(0);
        let amount = amount.map(|value| value.0).unwrap_or(available);
        require!(amount > 0, "withdraw amount must be positive");
        require!(available >= amount, "insufficient credit");

        self.credits.insert(&owner, &(available - amount));
        self.total_credits = self
            .total_credits
            .checked_sub(amount)
            .expect("credit total underflow");
        self.total_in_flight = self
            .total_in_flight
            .checked_add(amount)
            .expect("in-flight overflow");
        let id = self.next_withdrawal_id;
        self.next_withdrawal_id = self
            .next_withdrawal_id
            .checked_add(1)
            .expect("withdrawal id overflow");
        let withdrawal = Withdrawal {
            id,
            owner: owner.clone(),
            amount_yocto: amount,
            status: WithdrawalStatus::InFlight,
        };
        self.withdrawals.insert(&id, &withdrawal);
        events::emit(
            "withdrawal_started",
            WithdrawalEvent {
                withdrawal_id: id,
                owner: &owner,
                amount_yocto: amount.to_string(),
            },
        );

        Promise::new(owner)
            .transfer(NearToken::from_yoctonear(amount))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(near_sdk::Gas::from_tgas(8))
                    .on_withdraw_complete(id),
            )
    }

    #[private]
    pub fn on_withdraw_complete(&mut self, withdrawal_id: WithdrawalId) -> bool {
        let Some(mut withdrawal) = self.withdrawals.get(&withdrawal_id) else {
            return false;
        };
        if withdrawal.status != WithdrawalStatus::InFlight {
            return false;
        }
        self.total_in_flight = self
            .total_in_flight
            .checked_sub(withdrawal.amount_yocto)
            .expect("in-flight underflow");
        if env::promise_result_checked(0, 1024).is_ok() {
            withdrawal.status = WithdrawalStatus::Completed;
            self.withdrawals.insert(&withdrawal_id, &withdrawal);
            events::emit(
                "withdrawal_completed",
                WithdrawalEvent {
                    withdrawal_id,
                    owner: &withdrawal.owner,
                    amount_yocto: withdrawal.amount_yocto.to_string(),
                },
            );
            true
        } else {
            withdrawal.status = WithdrawalStatus::Restored;
            self.withdrawals.insert(&withdrawal_id, &withdrawal);
            self.add_credit(&withdrawal.owner, withdrawal.amount_yocto);
            events::emit(
                "withdrawal_restored",
                WithdrawalEvent {
                    withdrawal_id,
                    owner: &withdrawal.owner,
                    amount_yocto: withdrawal.amount_yocto.to_string(),
                },
            );
            false
        }
    }

    pub fn get_service(&self, service_id: ServiceId) -> Option<Service> {
        self.services.get(&service_id)
    }

    pub fn get_series(&self, series_id: SeriesId) -> Option<RevenueSeriesView> {
        self.series.get(&series_id).map(Into::into)
    }

    pub fn get_order(&self, order_id: OrderId) -> Option<ApiOrderView> {
        self.orders.get(&order_id).map(Into::into)
    }

    pub fn get_credit(&self, account_id: AccountId) -> U128 {
        U128(self.credits.get(&account_id).unwrap_or(0))
    }

    pub fn get_withdrawal(&self, withdrawal_id: WithdrawalId) -> Option<WithdrawalView> {
        self.withdrawals.get(&withdrawal_id).map(Into::into)
    }

    pub fn get_active_series(&self, service_id: ServiceId) -> Option<SeriesId> {
        self.active_series_by_service.get(&service_id)
    }

    pub fn get_open_order_count(&self, series_id: SeriesId) -> u32 {
        self.open_orders_by_series.get(&series_id).unwrap_or(0)
    }

    pub fn is_transfer_pending(&self, token_id: TokenId) -> bool {
        self.pending_transfers.get(&token_id).is_some()
    }

    pub fn audit_totals(&self) -> AuditTotals {
        let liabilities = self
            .total_credits
            .checked_add(self.total_order_escrow)
            .and_then(|value| value.checked_add(self.total_in_flight))
            .expect("liability overflow");
        let storage_locked = u128::from(env::storage_usage())
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .expect("storage cost overflow");
        let balance = env::account_balance().as_yoctonear();
        let available = balance
            .saturating_sub(storage_locked)
            .saturating_sub(self.operating_reserve);
        AuditTotals {
            total_credits: U128(self.total_credits),
            active_order_escrow: U128(self.total_order_escrow),
            in_flight_withdrawals: U128(self.total_in_flight),
            total_liabilities: U128(liabilities),
            total_funded_advances: U128(self.total_funded_advances),
            total_settled_revenue: U128(self.total_settled_revenue),
            total_refunds: U128(self.total_refunds),
            contract_balance: U128(balance),
            storage_locked: U128(storage_locked),
            operating_reserve: U128(self.operating_reserve),
            solvent: available >= liabilities,
        }
    }

    pub(crate) fn token_id_for(series_id: &str) -> TokenId {
        format!("right:{series_id}")
    }

    fn add_credit(&mut self, account_id: &AccountId, amount: u128) {
        let current = self.credits.get(account_id).unwrap_or(0);
        self.credits.insert(
            account_id,
            &current
                .checked_add(amount)
                .expect("account credit overflow"),
        );
        self.total_credits = self
            .total_credits
            .checked_add(amount)
            .expect("credit total overflow");
    }

    fn close_open_order(&mut self, series_id: &SeriesId) {
        let open = self.open_orders_by_series.get(series_id).unwrap_or(0);
        require!(open > 0, "open order accounting underflow");
        self.open_orders_by_series.insert(series_id, &(open - 1));
    }

    fn assert_exact_deposit(expected: u128, label: &str) {
        require!(
            env::attached_deposit().as_yoctonear() == expected,
            format!("exact {label} required: {expected} yoctoNEAR")
        );
    }

    fn assert_identifier(value: &str, label: &str) {
        require!(
            !value.is_empty() && value.len() <= 64,
            format!("{label} must be 1..64 bytes")
        );
        require!(
            value
                .bytes()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, b'-' | b'_' | b'.')),
            format!("{label} contains invalid characters")
        );
    }

    fn assert_hash(value: &str, label: &str) {
        require!(
            value.len() == 64 && value.bytes().all(|ch| ch.is_ascii_hexdigit()),
            format!("{label} must be a 64-character hex SHA-256")
        );
    }

    fn nonce_key(buyer: &AccountId, series_id: &str, client_nonce: &str) -> Vec<u8> {
        env::sha256(format!("{buyer}|{series_id}|{client_nonce}").as_bytes())
    }

    fn hash_hex(bytes: &[u8]) -> String {
        let mut value = String::with_capacity(bytes.len() * 2);
        for byte in bytes {
            use core::fmt::Write;
            write!(&mut value, "{byte:02x}").expect("writing to String cannot fail");
        }
        value
    }
}

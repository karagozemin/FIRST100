use crate::contract::ContractExt;
use crate::Contract;
use near_contract_standards::non_fungible_token::approval::NonFungibleTokenApproval;
use near_contract_standards::non_fungible_token::core::{
    NonFungibleTokenCore, NonFungibleTokenResolver,
};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{Token, TokenId};
use near_sdk::collections::{LookupMap, UnorderedSet};
use near_sdk::json_types::U128;
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, Gas, Promise, PromiseOrValue,
};
use std::collections::HashMap;

const GAS_FOR_RESOLVE_TRANSFER: Gas = Gas::from_tgas(8);
const ENUMERATION_PREFIX: &[u8] = b"first100:nft-enumeration:v1";
const APPROVAL_PREFIX: &[u8] = b"first100:nft-approvals:v1";

#[ext_contract(ext_first100_nft_receiver)]
#[allow(dead_code)]
trait First100NftReceiver {
    fn nft_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_id: AccountId,
        token_id: TokenId,
        msg: String,
    ) -> PromiseOrValue<bool>;
}

#[ext_contract(ext_first100_nft_resolver)]
#[allow(dead_code)]
trait First100NftResolver {
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool;
}

#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        let sender = env::predecessor_account_id();
        self.tokens
            .internal_transfer(&sender, &receiver_id, &token_id, approval_id, memo);
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        assert_one_yocto();
        assert!(
            self.pending_transfers.get(&token_id).is_none(),
            "token transfer is already pending"
        );
        let sender = env::predecessor_account_id();
        let (previous_owner, previous_approvals) =
            self.tokens
                .internal_transfer(&sender, &receiver_id, &token_id, approval_id, memo);
        self.pending_transfers.insert(&token_id, &true);

        ext_first100_nft_receiver::ext(receiver_id.clone())
            .with_unused_gas_weight(1)
            .nft_on_transfer(sender, previous_owner.clone(), token_id.clone(), msg)
            .then(
                ext_first100_nft_resolver::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RESOLVE_TRANSFER)
                    .with_unused_gas_weight(0)
                    .nft_resolve_transfer(
                        previous_owner,
                        receiver_id,
                        token_id,
                        previous_approvals,
                    ),
            )
            .into()
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        let result = self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id.clone(),
            approved_account_ids,
        );
        self.pending_transfers.remove(&token_id);
        result
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "FIRST100 Revenue Rights".to_string(),
            symbol: "F100".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}

#[near]
impl NonFungibleTokenApproval for Contract {
    #[payable]
    fn nft_approve(
        &mut self,
        token_id: TokenId,
        account_id: AccountId,
        msg: Option<String>,
    ) -> Option<Promise> {
        self.tokens.nft_approve(token_id, account_id, msg)
    }

    #[payable]
    fn nft_revoke(&mut self, token_id: TokenId, account_id: AccountId) {
        self.tokens.nft_revoke(token_id, account_id);
    }

    #[payable]
    fn nft_revoke_all(&mut self, token_id: TokenId) {
        self.tokens.nft_revoke_all(token_id);
    }

    fn nft_is_approved(
        &self,
        token_id: TokenId,
        approved_account_id: AccountId,
        approval_id: Option<u64>,
    ) -> bool {
        self.tokens
            .nft_is_approved(token_id, approved_account_id, approval_id)
    }
}

#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens
            .nft_tokens(from_index, Some(limit.unwrap_or(50).min(100)))
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, Some(limit.unwrap_or(50).min(100)))
    }
}

#[near]
impl Contract {
    /// Enables NEP-171 approval and owner enumeration maps after a code upgrade.
    /// The base token fields already contain these optional maps, so this does
    /// not alter the serialized contract state layout.
    pub fn enable_nft_extensions(&mut self) -> bool {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
        if self.tokens.tokens_per_owner.is_some() && self.tokens.approvals_by_id.is_some() {
            return false;
        }

        let existing = self.tokens.owner_by_id.iter().collect::<Vec<_>>();
        let mut per_owner = LookupMap::new(ENUMERATION_PREFIX.to_vec());
        for (token_id, owner_id) in existing {
            let mut prefix = b"first100:nft-owner:v1:".to_vec();
            prefix.extend(env::sha256(owner_id.as_bytes()));
            let mut tokens = per_owner
                .get(&owner_id)
                .unwrap_or_else(|| UnorderedSet::new(prefix));
            tokens.insert(&token_id);
            per_owner.insert(&owner_id, &tokens);
        }
        self.tokens.tokens_per_owner = Some(per_owner);
        self.tokens.approvals_by_id = Some(LookupMap::new(APPROVAL_PREFIX.to_vec()));
        let mut next_prefix = APPROVAL_PREFIX.to_vec();
        next_prefix.extend(b":next");
        self.tokens.next_approval_id_by_id = Some(LookupMap::new(next_prefix));
        true
    }
}

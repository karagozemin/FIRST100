//! FIRST100 revenue-right contract.
//! Implementation lives in focused modules so accounting and NFT behavior can be audited separately.

mod contract;
mod events;
mod models;
mod nft;

pub use contract::Contract;
pub use models::*;

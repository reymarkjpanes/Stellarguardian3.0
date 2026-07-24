//! Stellar Guardian Escrow Contract (Soroban)
//!
//! A trustless escrow smart contract for hackathon prize distribution.
//!
//! Lifecycle:
//! 1. Platform calls `initialize` with organizer address, event_id, and target amount
//! 2. Organizer calls `deposit` to fund the escrow (can be partial or full)
//!    OR platform calls `admin_deposit` for sponsor deposits from any address
//! 3. Platform calls `lock` once fully funded (prevents further deposits)
//! 4. Platform calls `disburse_batch` one or more times to distribute prizes
//! 5. Platform calls `finalize` after all batches to mark as Released
//! 6. OR Platform calls `refund` to return all funds (on event cancellation)
//!
//! Security:
//! - Only the designated organizer can deposit via `deposit`
//! - Admin can authorize deposits from any address via `admin_deposit`
//! - Only the platform admin can lock, disburse_batch, finalize, or refund
//! - State transitions are enforced (can't disburse if not locked, etc.)
//! - All amounts use i128 (stroops precision)
//! - TTL extended on all write operations to prevent contract expiry

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Bytes, Env, Vec, token,
};

#[contracttype]
#[derive(Clone, Copy, PartialEq)]
pub enum EscrowState {
    PendingFunding = 0,
    PartiallyFunded = 1,
    FullyFunded = 2,
    Locked = 3,
    Released = 4,
    Refunded = 5,
}

#[contracttype]
pub enum DataKey {
    Admin,           // Address - platform admin
    Organizer,       // Address - event organizer
    EventId,         // Bytes - event UUID
    Target,          // i128 - prize pool target (stroops)
    Balance,         // i128 - current balance
    State,           // EscrowState
    Token,           // Address - token contract (native XLM wrapper)
    DisbursedTotal,  // i128 - cumulative amount disbursed across batches
}

/// TTL values for contract instance storage.
const TTL_THRESHOLD: u32 = 50_000;
const TTL_EXTEND: u32 = 100_000;

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize a new escrow instance.
    /// Can only be called once (fails if already initialized).
    pub fn initialize(
        env: Env,
        admin: Address,
        organizer: Address,
        event_id: Bytes,
        target: i128,
        token: Address,
    ) {
        // Ensure not already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Organizer, &organizer);
        env.storage().instance().set(&DataKey::EventId, &event_id);
        env.storage().instance().set(&DataKey::Target, &target);
        env.storage().instance().set(&DataKey::Balance, &0i128);
        env.storage().instance().set(&DataKey::State, &EscrowState::PendingFunding);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::DisbursedTotal, &0i128);

        // Extend TTL for the contract instance
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    /// Deposit funds into the escrow. Only the organizer can deposit.
    /// Automatically transitions state based on cumulative balance.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();

        let organizer: Address = env.storage().instance().get(&DataKey::Organizer).unwrap();
        assert!(from == organizer, "Only organizer can deposit");

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(
            state == EscrowState::PendingFunding || state == EscrowState::PartiallyFunded,
            "Cannot deposit in current state"
        );

        // Transfer tokens from organizer to this contract
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Update balance
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        let new_balance = current_balance + amount;
        env.storage().instance().set(&DataKey::Balance, &new_balance);

        // Update state based on target
        let target: i128 = env.storage().instance().get(&DataKey::Target).unwrap();
        let new_state = if new_balance >= target {
            EscrowState::FullyFunded
        } else {
            EscrowState::PartiallyFunded
        };
        env.storage().instance().set(&DataKey::State, &new_state);

        // Refresh TTL on deposit
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("deposit"),),
            (from, amount, new_balance),
        );
    }

    /// Admin-authorized deposit from any address (sponsor use case).
    /// The admin authorizes the operation, and the sender confirms the transfer.
    pub fn admin_deposit(env: Env, from: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        from.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(
            state == EscrowState::PendingFunding || state == EscrowState::PartiallyFunded,
            "Cannot deposit in current state"
        );

        // Transfer tokens from sender to this contract
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Update balance
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        let new_balance = current_balance + amount;
        env.storage().instance().set(&DataKey::Balance, &new_balance);

        // Update state based on target
        let target: i128 = env.storage().instance().get(&DataKey::Target).unwrap();
        let new_state = if new_balance >= target {
            EscrowState::FullyFunded
        } else {
            EscrowState::PartiallyFunded
        };
        env.storage().instance().set(&DataKey::State, &new_state);

        // Refresh TTL
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("sponsor"),),
            (from, amount, new_balance),
        );
    }

    /// Lock the escrow. Only admin can lock. Must be FullyFunded.
    pub fn lock(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::FullyFunded, "Must be fully funded to lock");

        env.storage().instance().set(&DataKey::State, &EscrowState::Locked);

        // Refresh TTL on lock
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("locked"),), ());
    }

    /// Disburse a batch of prizes. Does NOT transition state to Released.
    /// Call `finalize` after all batches are processed.
    /// Only admin can disburse. Must be Locked.
    pub fn disburse_batch(env: Env, recipients: Vec<Address>, amounts: Vec<i128>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Locked, "Must be locked to disburse");
        assert!(recipients.len() == amounts.len(), "Recipients and amounts must match");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();

        let mut total_disbursed: i128 = 0;

        for i in 0..recipients.len() {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            token_client.transfer(&contract_addr, &recipient, &amount);
            total_disbursed += amount;
        }

        // Update balance
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        env.storage().instance().set(&DataKey::Balance, &(current_balance - total_disbursed));

        // Track cumulative disbursement
        let prev_total: i128 = env.storage().instance().get(&DataKey::DisbursedTotal).unwrap_or(0);
        env.storage().instance().set(&DataKey::DisbursedTotal, &(prev_total + total_disbursed));

        // DO NOT change state — remains Locked until finalize() is called

        // Refresh TTL
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("batch"),),
            (recipients.len(), total_disbursed),
        );
    }

    /// Legacy disburse method — transitions to Released immediately.
    /// Kept for backward compat. Use disburse_batch + finalize for multi-batch.
    pub fn disburse(env: Env, recipients: Vec<Address>, amounts: Vec<i128>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Locked, "Must be locked to disburse");
        assert!(recipients.len() == amounts.len(), "Recipients and amounts must match");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();

        let mut total_disbursed: i128 = 0;

        for i in 0..recipients.len() {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            token_client.transfer(&contract_addr, &recipient, &amount);
            total_disbursed += amount;
        }

        // Update balance and state
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        env.storage().instance().set(&DataKey::Balance, &(current_balance - total_disbursed));
        env.storage().instance().set(&DataKey::State, &EscrowState::Released);

        let prev_total: i128 = env.storage().instance().get(&DataKey::DisbursedTotal).unwrap_or(0);
        env.storage().instance().set(&DataKey::DisbursedTotal, &(prev_total + total_disbursed));

        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("disburse"),),
            (recipients.len(), total_disbursed),
        );
    }

    /// Finalize disbursement — transitions state to Released.
    /// Called after all disburse_batch calls are complete.
    /// Only admin can finalize. Must be Locked.
    pub fn finalize(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Locked, "Must be locked to finalize");

        env.storage().instance().set(&DataKey::State, &EscrowState::Released);

        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("finalize"),), ());
    }

    /// Refund all funds to the organizer. Only admin can refund.
    /// Cannot refund if already Released.
    pub fn refund(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(
            state != EscrowState::Released && state != EscrowState::Refunded,
            "Cannot refund in current state"
        );

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        if balance > 0 {
            let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let token_client = token::Client::new(&env, &token_addr);
            let organizer: Address = env.storage().instance().get(&DataKey::Organizer).unwrap();
            token_client.transfer(&env.current_contract_address(), &organizer, &balance);
        }

        env.storage().instance().set(&DataKey::Balance, &0i128);
        env.storage().instance().set(&DataKey::State, &EscrowState::Refunded);

        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("refund"),), balance);
    }

    // --- Read-only queries ---

    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    pub fn get_state(env: Env) -> u32 {
        let state: EscrowState = env.storage().instance().get(&DataKey::State)
            .unwrap_or(EscrowState::PendingFunding);
        state as u32
    }

    pub fn get_target(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Target).unwrap_or(0)
    }

    pub fn get_disbursed_total(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::DisbursedTotal).unwrap_or(0)
    }

    pub fn is_locked(env: Env) -> bool {
        let state: EscrowState = env.storage().instance().get(&DataKey::State)
            .unwrap_or(EscrowState::PendingFunding);
        state == EscrowState::Locked
    }

    pub fn get_organizer(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Organizer).unwrap()
    }

    pub fn get_event_id(env: Env) -> Bytes {
        env.storage().instance().get(&DataKey::EventId).unwrap()
    }
}

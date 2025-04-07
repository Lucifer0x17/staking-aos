# Staking and Token System Documentation

## Overview

This documentation describes a comprehensive staking and token system implemented in Lua. The system consists of two main components:
1. A token system (`token.lua`) implementing the ao Standard Token Specification
2. A staking system (`staking.lua`) that allows users to stake tokens with slashing capabilities

## Token System

### Core Features
- Implements the ao Standard Token Specification
- Supports token transfers, minting, burning, and balance queries
- Uses big integer arithmetic for precise token calculations
- Maintains a total supply and individual balances

### Key Components

#### State Variables
- `Variant`: Current version of the token system
- `Denomination`: Decimal places for token precision (default: 12)
- `Balances`: Map of addresses to their token balances
- `TotalSupply`: Total number of tokens in circulation
- `Name`: Token name (default: 'Test Coin')
- `Ticker`: Token symbol (default: 'TEST')
- `Logo`: Token logo identifier

#### Available Actions

1. **Info**
   - Returns token parameters (Name, Ticker, Logo, Denomination)
   - Action Tag: "Info"

2. **Balance**
   - Returns token balance for a specified address
   - If no address specified, returns sender's balance
   - Action Tag: "Balance"

3. **Balances**
   - Returns balances of all participants
   - Action Tag: "Balances"

4. **Transfer**
   - Transfers tokens from sender to recipient
   - Requires sufficient balance
   - Sends Credit-Notice and Debit-Notice messages
   - Action Tag: "Transfer"

5. **Mint**
   - Creates new tokens (only process owner can mint)
   - Increases total supply
   - Action Tag: "Mint"

6. **Burn**
   - Destroys tokens from sender's balance
   - Reduces total supply
   - Action Tag: "Burn"

7. **Get Token**
   - Utility function to get test tokens
   - Sends 10 TEST tokens to requester
   - Action Tag: "Get"

## Staking System

### Core Features
- Allows users to stake tokens
- Implements cooldown period for unstaking
- Supports slashing mechanism for misbehavior
- Voting system for slashing proposals

### Key Components

#### State Variables
- `Stakes`: Map of addresses to their stake information
- `SlashProposals`: Map of proposal IDs to proposal details
- `TokenProcess`: Address of the token process
- `CooldownPeriod`: Time required before unstaking (default: 30 days)
- `MinimumStake`: Minimum amount required for staking (default: 10 tokens)

#### Slash Configuration
- `VOTING_PERIOD`: 7 days
- `QUORUM_PERCENTAGE`: 50% of total staked tokens
- `SLASH_PERCENTAGE`: 20% of staked tokens
- `MINIMUM_SLASH_VOTES`: 3 unique voters required

#### Available Actions

1. **Stake**
   - Stake tokens in the system
   - Requires minimum stake amount
   - Updates stake information
   - Action Tag: "Stake"

2. **Unstake**
   - Initiates unstaking process
   - Starts cooldown period
   - Action Tag: "Unstake"

3. **Withdraw**
   - Withdraws tokens after cooldown period
   - Transfers tokens back to user
   - Action Tag: "Withdraw"

4. **Create Slash Proposal**
   - Creates a proposal to slash a user's stake
   - Requires target address and reason
   - Action Tag: "Create-Slash-Proposal"

5. **Vote on Slash Proposal**
   - Vote on existing slash proposals
   - Only stakers can vote
   - Action Tag: "Vote-Slash-Proposal"

6. **Finalize Slash Proposal**
   - Concludes voting and executes slashing if passed
   - Checks quorum and voting requirements
   - Action Tag: "Finalize-Slash-Proposal"

7. **View Stake**
   - View stake information for an address
   - Shows amount, status, and cooldown details
   - Action Tag: "View-Stake"

8. **View All Stakes**
   - View all stakes in the system
   - Action Tag: "View-All-Stakes"

9. **View Proposal**
   - View details of a specific slash proposal
   - Action Tag: "View-Proposal-By-Id"

10. **View All Proposals**
    - View all slash proposals
    - Action Tag: "View-All-Proposals"

## Utility Functions

### Token System
- `utils.add`: Adds two big integers
- `utils.subtract`: Subtracts two big integers
- `utils.toBalanceValue`: Converts to balance format
- `utils.toNumber`: Converts to number

### Staking System
- `utils.add`: Adds two big integers
- `utils.subtract`: Subtracts two big integers
- `utils.multiply`: Multiplies two big integers
- `utils.divide`: Divides two big integers
- `utils.percentage`: Calculates percentage
- `utils.toBalanceValue`: Converts to balance format
- `utils.isGreaterThanOrEqual`: Compares two big integers

## Security Considerations

1. **Token Security**
   - Only process owner can mint new tokens
   - Transfers require sufficient balance
   - Big integer arithmetic prevents overflow

2. **Staking Security**
   - Minimum stake requirement
   - Cooldown period for unstaking
   - Slashing mechanism with voting requirements
   - Quorum and minimum vote requirements

## Usage Examples

### Token Operations
```lua
-- Get token info
Send({ Action = "Info" })

-- Check balance
Send({ Action = "Balance" })

-- Transfer tokens
Send({
  Action = "Transfer",
  Recipient = "target-address",
  Quantity = "1000000000000"
})

-- Get test tokens
Send({ Action = "Get" })
```

### Staking Operations
```lua
-- Stake tokens
Send({
  Action = "Stake",
  Quantity = "10000000000000"
})

-- Unstake tokens
Send({ Action = "Unstake" })

-- Withdraw after cooldown
Send({ Action = "Withdraw" })

-- Create slash proposal
Send({
  Action = "Create-Slash-Proposal",
  Target = "target-address",
  Reason = "Misbehavior"
})

-- Vote on proposal
Send({
  Action = "Vote-Slash-Proposal",
  ProposalId = "proposal-id",
  Vote = "Yes"
})
```

## Error Handling

The system implements comprehensive error handling:
- Input validation for all operations
- Balance checks for transfers
- Permission checks for administrative actions
- State validation for staking operations
- Voting period and quorum checks for slashing

## Dependencies

- `json`: For JSON encoding/decoding
- `bint`: For big integer arithmetic
- `ao`: For process identification and messaging

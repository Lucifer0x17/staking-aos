# AO Staking Process Documentation

## Overview

This Lua process implements a sophisticated staking mechanism for the Arweave Operating System (AO) with advanced features including:
- Token staking
- Unstaking with cooldown periods
- Slash voting mechanism
- Stake management and tracking

## Dependencies

The process requires two key libraries:
- `json`: For JSON encoding/decoding
- `bint`: For handling large integer calculations with 256-bit precision

## Constants and Configuration

### Stake Status
- `STAKED`: Active stake state
- `IN_COOLDOWN`: Stake is in withdrawal cooldown

### Slash Proposal Configuration
- Voting Period: 7 days
- Quorum Percentage: 50%
- Slash Percentage: 20%
- Minimum Slash Votes: 3

### Key Parameters
- Minimum Stake: 10 tokens
- Cooldown Period: 30 days

## Core Functionality

### 1. Staking Tokens

#### `stake` Handler
- Validates stake against minimum requirements
- Initializes stake data structure
- Updates stake information
- Sends confirmation message

##### Validation Checks
- Token process must be set
- Stake quantity must be provided
- Stake amount must exceed minimum threshold

### 2. Unstaking Process

#### `unstake` Handler
- Initiates cooldown period for staked tokens
- Updates stake status to `IN_COOLDOWN`
- Provides withdrawal timeline information

### 3. Token Withdrawal

#### `withdraw` Handler
- Allows withdrawal after cooldown period
- Performs safe token transfer
- Resets stake data upon successful withdrawal

### 4. Slash Mechanism

#### Slash Proposal Lifecycle
1. `createSlashProposal`: Initiate a slash proposal
   - Requires target address with active stake
   - Creates a unique proposal

2. `voteOnSlashProposal`: Voting mechanism
   - Only stakers can vote
   - Tracks vote weight based on stake amount
   - Prevents duplicate voting

3. `finalizeSlashProposal`: Proposal resolution
   - Checks voting period completion
   - Calculates quorum and voting results
   - Executes stake slashing if proposal passes

### 5. Stake Information Retrieval

#### Proposal Viewing Handlers
- `viewProposalById`: Detailed single proposal view
- `viewAllProposals`: List of all proposals

#### Stake Information Handlers
- `viewStake`: Individual stake details
- `viewAllStakes`: Comprehensive stake overview

## Utility Functions

### `utils` Module
Provides essential big integer operations:
- `add`: Safe addition
- `subtract`: Safe subtraction
- `multiply`: Safe multiplication
- `divide`: Safe division
- `percentage`: Calculates percentage
- `toBalanceValue`: Converts to balance representation
- `isGreaterThanOrEqual`: Comparison utility

## Error Handling

The process includes comprehensive error checking:
- Explicit assertions for input validation
- Safe transfer mechanisms
- Detailed error messaging

## Security Considerations

- Minimum stake requirements
- Cooldown periods
- Slash voting with quorum
- Stake weight-based voting

## Example Interactions

### Staking Tokens
```lua
-- Send a message to stake tokens
{
  Action = "Credit-Notice",
  X-Action = "Stake",
  Quantity = "20000000000000"  -- 20 tokens
}
```

### Creating Slash Proposal
```lua
{
  Action = "Create-Slash-Proposal",
  Target = "wallet_address_to_slash",
  Reason = "Violation of network rules"
}
```

### Voting on Proposal
```lua
{
  Action = "Vote-Slash-Proposal",
  ProposalId = "unique_proposal_id",
  Vote = "Yes"  -- or "No"
}
```

## Potential Improvements
- Enhanced logging
- More granular stake management
- Additional slash proposal checks

## Limitations
- Requires token process address
- Relies on precise timestamp tracking
- Manual proposal finalization

## Best Practices
- Always check stake status before actions
- Understand cooldown and slash mechanisms
- Verify transaction details carefully

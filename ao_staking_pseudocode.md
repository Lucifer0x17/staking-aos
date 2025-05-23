# AO Staking & Slash Governance Process (Pseudocode Summary)

## 🧩 Initialization

- **Imports**: `json`, `bint` for big integer math
- **Utils**: Arithmetic, percentage, comparisons, conversions
- **Global State**:
  - `Stakes[address] = { amount, stakeTime, cooldownStart, status }`
  - `SlashProposals[proposalId] = { targetAddress, proposer, votes, ... }`
- **Constants**:
  - `TokenProcess`: Linked token agent
  - `CooldownPeriod`: 30 days
  - `MinimumStake`: 10 tokens
- **Config (SlashConfig)**:
  - `VOTING_PERIOD = 7 days`
  - `QUORUM_PERCENTAGE = 50%`
  - `SLASH_PERCENTAGE = 20%`
  - `MINIMUM_SLASH_VOTES = 3`
- **Status Enums**:
  - Stake: `STAKED`, `IN_COOLDOWN`
  - Proposal: `OPEN`, `FAILED`, `EXECUTED`

---

## ✅ Stake Handler

**Trigger**: Valid `Credit-Notice` with `X-Action = Stake` from TokenProcess

```
- Validate stake >= MinimumStake
- Initialize or update user's stake
- Add new stake amount
- Set `stakeTime`, reset `cooldownStart`, set status = STAKED
- Respond with `Stake-Success`
Else:
- Refund tokens with `Stake amount below minimum`
```

---

## ⏳ Unstake Handler

**Trigger**: `Action = Unstake`

```
- Require user has an active stake
- Require status = STAKED
- Start cooldown: set `cooldownStart = msg.Timestamp`, status = IN_COOLDOWN
- Respond with `Unstake-Initiated`, show time to withdrawal
```

---

## 💸 Withdraw Handler

**Trigger**: `Action = Withdraw`

```
- Require status = IN_COOLDOWN
- Require cooldown period completed
- Call TokenProcess to transfer tokens back
  - On success: reset stake, respond with `Withdraw-Success`
  - On failure: respond with `Withdraw-Failure`
```

---

## ⚔️ Create Slash Proposal

**Trigger**: `Action = Create-Slash-Proposal`

```
- Require target address is staked
- Create a new proposal ID = msg.Id
- Store proposer, target, reason, votes map, timestamps
- Respond with `Slash-Proposal-Created`
```

---

## 🗳️ Vote on Slash Proposal

**Trigger**: `Action = Vote-Slash-Proposal`

```
- Require proposal exists and is OPEN
- Require voter hasn't already voted
- Record vote with weight = staker's amount
- Update vote count, total weight
- Respond with `Slash-Vote-Recorded`
```

---

## ✅ Finalize Slash Proposal

**Trigger**: `Action = Finalize-Slash-Proposal`

```
- Require voting period has passed
- Count YES/NO votes, compute % support
- Check quorum and min vote count
If passed:
  - Slash target’s stake by % from SlashConfig
  - Set proposal status = EXECUTED
  - Notify target
Else:
  - Set proposal status = FAILED
- Respond with `Slash-Proposal-Finalized`
```

---

## 👁 View Stake Info

### `Action = View-Stake`

```
- Return current user's or target's stake info
- Show remaining cooldown time (if in cooldown)
```

---

## 📜 View Proposals

### `Action = View-Proposal-By-Id`

```
- Return full details of a specific proposal
- Include vote weights, breakdown, vote %s
```

### `Action = View-All-Proposals`

```
- List all proposals with summaries
- Sort by creation time (latest first)
- Include yes/no vote weights
```

---

## 🔍 View All Stakes (Admin)

### `Action = View-All-Stakes`

```
- Return all stakes with complete info
```

---
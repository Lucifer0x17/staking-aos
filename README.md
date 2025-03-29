testtoken: pHhtDqGidVc-2HQ01NMGmBbIjEYcaqOagdh9yRSljmg
testStake: Iod3FVjz3X5hHo8QqnckBdwwNPr9viKeVb6qGsMMYzE


Send({
    Target = "pHhtDqGidVc-2HQ01NMGmBbIjEYcaqOagdh9yRSljmg",
    Action = "Transfer",
    Quantity = "10000000000000",
    Recipient = "Iod3FVjz3X5hHo8QqnckBdwwNPr9viKeVb6qGsMMYzE",
    ["X-Action"] = "Stake"
})

Send({
    Target = "Iod3FVjz3X5hHo8QqnckBdwwNPr9viKeVb6qGsMMYzE",
    Action = "Unstake",
})

Send({
    Target = "Iod3FVjz3X5hHo8QqnckBdwwNPr9viKeVb6qGsMMYzE",
    Action = "Withdraw",
})

```lua
  -- Broadcast using ao.assign with StakerAddresses
  ao.assign({
    Targets = StakerAddresses,
    Action = "Slash-Proposal-Notification",
    Data = json.encode({
      proposalId = proposalId,
      targetAddress = msg.Tags.Target,
      reason = SlashProposals[proposalId].reason,
      slashAmount = SlashProposals[proposalId].slashAmount,
      votingDeadline = msg.Timestamp + Config.VOTING_PERIOD
    })
  })
```
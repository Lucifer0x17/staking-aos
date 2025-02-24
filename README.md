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
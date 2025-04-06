import assert from "assert"
import { describe, it, before } from "node:test"
import path from "path"
import { AO, acc } from "wao/test"
import fs from 'fs'


describe("Staking proceess Tests", function () {
  let ao
  let tokenProcess, tokenPid
  let stakingProcess, stakingPid

  let alice, bob, charlie

  const CooldownPeriod = 30 * 24 * 60 * 60 // 30 days in seconds (used for time advancement)
  const MinimumStake = "10000000000000" // 10 tokens (from staking.lua)
  const SlashVotingPeriod = 7 * 24 * 60 * 60 // 7 days voting period
  const TokenSupply = "10000000000000000" // 10000 tokens
  const TestTokenTransfer = "500000000000000" // 500 Tokens

  before(async () => {
    console.log("\x1b[33m== Setting up test environment ==\x1b[0m");
    try {
      ao = await new AO().init(acc[0])

      alice = acc[0]
      bob = acc[1]
      charlie = acc[2]



      // Read process source code
      const srcDir = path.resolve(".", "..", "src")
      const tokenSrc = fs.readFileSync(path.join(srcDir, "token.lua"), "utf8")
      const stakingSrc = fs.readFileSync(path.join(srcDir, "staking.lua"), "utf8")

      console.log("\x1b[36mDeploying token process...\x1b[0m")
      // Deploy token process with alice as the owner
      const { p: tokenProc, pid: tPid } = await ao.deploy({
        src_data: tokenSrc,
        signer: alice
      })
      tokenProcess = tokenProc
      tokenPid = tPid
      console.log("\x1b[36mToken process deployed with PID:\x1b[0m", tokenPid)

      console.log("\x1b[36mDeploying staking process...\x1b[0m")
      // Deploy staking process
      const { p: stakingProc, pid: sPid } = await ao.deploy({
        src_data: stakingSrc,
        signer: alice
      })
      stakingProcess = stakingProc
      stakingPid = sPid
      console.log("\x1b[36mStaking process deployed with PID:\x1b[0m", stakingPid)

      console.log("\x1b[36mConfiguring staking process...\x1b[0m")
      // Set the token process id in the staking process
      await ao.msg({ pid: stakingPid, act: "Eval", data: `TokenProcess="${tokenPid}"` })

      // Check if the token process id is set in the staking process
      const TokenState = await ao.msg({ pid: stakingPid, act: "Eval", data: `TokenProcess` })
      assert.equal(TokenState.res.Output.data, tokenPid, "Token process id should be set in staking process")

      // Check for token supply
      console.log("\x1b[36mChecking Token Supply...\x1b[0m")

      // Check Token balance of process
      const { out: tokenBalance } = await tokenProcess.msg("Balance", { Recipient: tokenPid })
      assert.equal(tokenBalance.toString(), TokenSupply, "\x1b[31mTokens were not minted\x1b[0m")
      console.log("\x1b[33m== Setting up Completed ==\x1b[0m");

    } catch (error) {
      console.log("\x1b[31mError during setup:\x1b[0m", error.message)
    }
  })

  describe("Token Operations", function () {
    it("should transfer tokens to alice, bob, and charlie", async () => {
      try {
        console.log("\x1b[36mTransferring Tokens to respective addresses...\x1b[0m")
        // Transfer tokens to alice
        await ao.msg({ pid: tokenPid, act: "Eval", data: `Send({Target=ao.id, Action="Transfer", Recipient="${alice.addr}", Quantity="${TestTokenTransfer}" })` })
        // Transfer tokens to bob
        await ao.msg({ pid: tokenPid, act: "Eval", data: `Send({Target=ao.id, Action="Transfer", Recipient="${bob.addr}", Quantity="${TestTokenTransfer}" })` })
        // Transfer tokens to charlie
        await ao.msg({ pid: tokenPid, act: "Eval", data: `Send({Target=ao.id, Action="Transfer", Recipient="${charlie.addr}", Quantity="${TestTokenTransfer}" })` })
      } catch (error) {
        console.error(`\x1b[31mTransaction failed: ${error.message}\x1b[0m`);
        throw error;
      }
    })

    it("should allow checking balances", async () => {
      try {
        console.log("\x1b[36mVerifying Token Balances...\x1b[0m")
        const { out: balancesArray } = await tokenProcess.msg("Balances")
        // Check Token balance of Alice
        assert.equal(balancesArray[alice.addr], TestTokenTransfer, "Alice did not receive the expected tokens")
        // Check Token balance of Bob
        assert.equal(balancesArray[bob.addr], TestTokenTransfer, "Bob did not receive the expected tokens")
        // Check Token balance of Charlie
        assert.equal(balancesArray[charlie.addr], TestTokenTransfer, "Charlie did not receive the expected tokens")
      } catch (error) {
        console.error(`\x1b[31m${error.message}\x1b[0m`)
        throw error
      }
    })
  })

  describe("Staking Handler Tests", function () {
    // Tests for the stake handler
    it("should successfully stake tokens with valid amount", async () => {
      try {

        // First, approve the staking contract to spend tokens
        const stakeAmount = MinimumStake

        // Need to transfer tokens from bob to staking process
        const msg = await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: stakeAmount,
          "X-Action": "Stake"
        }, { jwk: bob.jwk })

        // Verify the staking was successful by checking the stake data
        const bobStakeInfo = (await stakingProcess.v("Stakes"))[bob.addr]

        // Check that the stake was recorded correctly
        assert.equal(bobStakeInfo.amount, stakeAmount, "\x1b[31mStake amount not recorded correctly\x1b[0m")
        assert.equal(bobStakeInfo.status, "STAKED", "\x1b[31mStake status should be STAKED\x1b[0m")
        assert.notEqual(bobStakeInfo.stakeTime, 0, "\x1b[31mStake time should be recorded\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mStaking test failed: ${error.message}\x1b[0m`)
        throw error
      }
    })

    it("should fail to stake less than minimum amount", async () => {
      try {
        // Create an amount less than minimum
        const insufficientAmount = "1000000000000" // 1 token, below minimum of 10

        // Attempt to stake an insufficient amount
        const { mid } = await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: insufficientAmount,
          "X-Action": "Stake"
        }, { jwk: charlie.jwk })
        const { out } = await tokenProcess.res({ mid, get: ["Quantity", "Action"] })
        assert.equal(out.Quantity, insufficientAmount.toString(), "\x1b[31mStake amount not returned correctly\x1b[0m")
        assert.equal(out.Action, "Debit-Notice", "\x1b[31mWrong tag is sending the money\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
        throw error;
      }
    })

    it("should update stake amount when staking more tokens", async () => {
      try {

        // First, get bob's current stake
        const initialStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const initialStake = initialStakeResult.out
        const initialAmount = initialStake.stake.amount

        // Stake additional tokens
        const additionalAmount = MinimumStake
        await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: additionalAmount,
          "X-Action": "Stake"
        }, { jwk: bob.jwk })

        // Check that stake was updated correctly
        const updatedStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const updatedStake = updatedStakeResult.out

        // Expected amount is initialAmount + additionalAmount
        const expectedAmount = (BigInt(initialAmount) + BigInt(additionalAmount)).toString()

        assert.equal(updatedStake.stake.amount, expectedAmount, "\x1b[31mStake amount not updated correctly\x1b[0m")
      } catch (error) {
        console.error(`\x1b[31mUpdating stake test failed: ${error.message}\x1b[0m`)
        throw error
      }
    })

    it("should allow multiple users to stake tokens", async () => {
      try {
        // Alice stakes tokens
        const stakeAmount = MinimumStake
        await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: stakeAmount,
          "X-Action": "Stake"
        }, { jwk: alice.jwk })

        // Charlie stakes tokens
        await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: stakeAmount,
          "X-Action": "Stake"
        }, { jwk: charlie.jwk })

        // Verify both users have active stakes
        const aliceStakeResult = await stakingProcess.msg("View-Stake", { Target: alice.addr })
        const charlieStakeResult = await stakingProcess.msg("View-Stake", { Target: charlie.addr })

        const aliceStake = aliceStakeResult.out
        const charlieStake = charlieStakeResult.out

        assert.equal(aliceStake.stake.amount, stakeAmount, "\x1b[31mAlice's stake amount incorrect\x1b[0m")
        assert.equal(charlieStake.stake.amount, stakeAmount, "\x1b[31mCharlie's stake amount incorrect\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mMultiple user staking test failed: ${error.message}\x1b[0m`)
        throw error
      }
    })

    it("should allow viewing all stakes", async () => {
      try {

        // Get all stakes
        const allStakesResult = await stakingProcess.msg("View-All-Stakes")
        const allStakes = allStakesResult.out

        // Verify that all three users have stakes
        assert(allStakes[alice.addr], "\x1b[31mAlice's stake not found\x1b[0m")
        assert(allStakes[bob.addr], "\x1b[31mBob's stake not found\x1b[0m")
        assert(allStakes[charlie.addr], "\x1b[31mCharlie's stake not found\x1b[0m")
      } catch (error) {
        console.error(`\x1b[31mView all stakes test failed: ${error.message}\x1b[0m`)
        throw error
      }
    })
  })

  describe("Unstake Handler Tests", function () {
    it("should successfully initiate unstake and start cooldown", async () => {
      try {

        // First verify bob has an active stake
        const initialStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const initialStake = initialStakeResult.out
        assert.equal(initialStake.stake.status, "STAKED", "\x1b[31mBob's stake should be active before unstaking\x1b[0m")
        // Initiate unstake
        const { out: unstakeResult } = await stakingProcess.msg("Unstake", {}, { get: { Data: { data: true, json: true }, Action: "Action" }, jwk: bob.jwk })

        // Verify the response data
        assert(unstakeResult.Data, "\x1b[31mUnstake response should contain data\x1b[0m")
        assert(unstakeResult.Action === "Unstake-Initiated", "\x1b[31mAction should be Unstake-Initiated\x1b[0m")

        // Verify cooldown has started
        const updatedStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const updatedStake = updatedStakeResult.out

        assert.equal(updatedStake.stake.status, "IN_COOLDOWN", "\x1b[31mStake status should be IN_COOLDOWN\x1b[0m")
        assert.notEqual(updatedStake.stake.cooldownStart, 0, "\x1b[31mCooldown start time should be recorded\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mUnstake test failed: ${error.message}\x1b[0m`)
        throw error
      }
    })

    it("should fail to unstake when there is no active stake", async () => {
      try {
        const ar = ao.ar
        const { jwk } = await ar.gen("1")

        // Attempt to unstake with no active stake
        const { res } = await stakingProcess.msg("Unstake", { jwk: jwk })
        assert(res.Error.includes("No active stake found"), "\x1b[31mUnstake response should contain error\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)
        throw error
      }
    })

    it("should fail to unstake again when already in cooldown", async () => {
      try {
        // Attempt to unstake with no active stake
        const { res } = await stakingProcess.msg("Unstake", { jwk: bob.jwk })
        assert(res.Error.includes("Stake is already in cooldown"), "\x1b[31mUnstake response should contain error\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)
        throw error
      }
    })

    it("should show correct time remaining for cooldown", async () => {
      try {

        // Get bob's stake with cooldown info
        const stakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const stake = stakeResult.out
        // Verify cooldown period is set correctly
        assert(stake.timeRemaining > 0, "\x1b[31mCooldown time remaining should be greater than 0\x1b[0m")
        assert.equal(stake.canWithdraw, false, "\x1b[31mShould not be able to withdraw yet\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)
        throw error
      }
    })
  })

})